import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, skip, Subscription } from 'rxjs';
import { ConnectionService, ConnectionSubscriber } from './connection.service';
import { IdentifiedComponent } from './identified.component';
import { IncomingBaseMessage, Message, MessageType } from './messages/Message';
import { FetchMessage, ObjectMessage, StoreMessage } from './messages/data.messages';
import { WelcomeMessage, ByeMessage, HelloMessage } from './messages/admin.messages';

export interface ConfigurationEntry {
    key: string;
    value: unknown;
}

export type BackendConfigurationPayload = Record<string, unknown>;

interface StructuredKeySegment {
    property: string;
    selectors: Record<string, string>;
}

class ConfigurationConnectionClient extends IdentifiedComponent implements ConnectionSubscriber {
    protected token: string | null = null;
    private receivedObject: string | null = null;
    private receivedIndex: string | number | null = null;
    private receivedPayload: Record<string, unknown> = {};
    private configChangeSubscription: Subscription | null = null;

    private lastSentFrontendJson: string = '';
    private debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    private outstandingStore: boolean = false;

    constructor(
        protected readonly connectionService: ConnectionService,
        private readonly configurationService: ConfigurationStateService
    ) {
        super();
        this.setComponentID('ConfigurationStateService');
    }

    /** Stores the connection token received during the WebSocket handshake. */
    setToken(to: string): void {
        this.token = to;
    }

    /** Attaches the current token to the message and forwards it to the ConnectionService. */
    sendMessage(message: Message): void {
        if (this.token == null) {
            console.warn('Tried to send a message before the connection token was set', message);
            return;
        }
        message.token = this.token;
        this.connectionService.sendMessage(message, this.componentID);
    }

    /**
     * Dispatches every incoming WebSocket message to the appropriate handler.
     *
     * - HelloMessage / ByeMessage: handshake bookkeeping.
     * - WelcomeMessage: triggers the initial Fetch for the personal configuration.
     * - ObjectMessage with outstandingStore=true: treats the message as a store
     *   acknowledgment, clears the flag, and retries if config changed in flight.
     * - ObjectMessage with outstandingStore=false: initial (or refreshed) payload;
     *   loads frontend config, resets the change baseline, and sets up the
     *   change-subscription that drives future stores.
     */
    handleMessages(message: IncomingBaseMessage): void {
        if (message instanceof HelloMessage) {
            return;
        }

        if (message instanceof WelcomeMessage) {
            this.sendMessage(new FetchMessage('personalconfiguration', 'personal'));
            return;
        }

        if (message instanceof ByeMessage) {
            console.error('ConfigurationStateService connection login failed');
            return;
        }

        if (message.type === MessageType.Object) {
            if (this.outstandingStore) {
                this.outstandingStore = false;
                // Ack received — ignore stale backend data.
                // If the debounce already fired while the ack was in flight, retry now.
                if (this.debounceTimeout === null) {
                    const currentJson = JSON.stringify(
                        this.configurationService.serializeForBackend()
                    );
                    if (currentJson !== this.lastSentFrontendJson) {
                        this.doSend();
                    }
                }
                return;
            }

            const objMessage = message as ObjectMessage;
            this.receivedObject = objMessage.object;
            this.receivedIndex = objMessage.index;
            this.receivedPayload =
                objMessage.payload &&
                typeof objMessage.payload === 'object' &&
                !Array.isArray(objMessage.payload)
                    ? (objMessage.payload as Record<string, unknown>)
                    : {};
            const configurationPayload =
                this.receivedPayload['configuration'] &&
                typeof this.receivedPayload['configuration'] === 'object' &&
                !Array.isArray(this.receivedPayload['configuration'])
                    ? (this.receivedPayload['configuration'] as Record<string, unknown>)
                    : {};
            const frontendPayload = configurationPayload['frontend'];
            this.configurationService.loadFromBackend(
                frontendPayload &&
                    typeof frontendPayload === 'object' &&
                    !Array.isArray(frontendPayload)
                    ? frontendPayload
                    : {}
            );
            // Treat the freshly loaded state as the last-sent baseline so that
            // a Store is only issued when the user actually changes something.
            this.lastSentFrontendJson = JSON.stringify(
                this.configurationService.serializeForBackend()
            );
            if (!this.configChangeSubscription) {
                this.configChangeSubscription = this.configurationService.configItems$
                    .pipe(skip(1))
                    .subscribe(() => this.onConfigChanged());
            }
            return;
        }

        console.warn(
            'ConfigurationStateService received unexpected message type',
            message.type,
            message
        );
    }

    /** Logs the error and removes the broken connection from the ConnectionService. */
    handleError(error: unknown): void {
        console.error('ConfigurationStateService connection error', error);
        this.connectionService.removeConnection(this.componentID);
    }

    /** Called when the WebSocket connection is closed by the server. */
    handleComplete(): void {
        console.warn(`ConfigurationStateService connection closed for ${this.componentID}.`);
    }

    /** Opens a new WebSocket connection, observing the full handshake sequence. */
    connect(): void {
        this.connectionService.getNewConnection(this, true);
    }

    /**
     * Called on every config-map emission after the initial backend load.
     * Resets the debounce timer so a store is only sent after the config
     * has been silent for `configuration.storeDebounceSeconds` seconds (default 1).
     */
    private onConfigChanged(): void {
        const debounceSeconds =
            this.configurationService.getItem<number>('configuration.storeDebounceSeconds') ?? 1;
        if (this.debounceTimeout !== null) {
            clearTimeout(this.debounceTimeout);
        }
        this.debounceTimeout = setTimeout(() => {
            this.debounceTimeout = null;
            this.doSend();
        }, debounceSeconds * 1000);
    }

    /**
     * Serializes the current frontend configuration and sends a StoreMessage if
     * the content actually changed since the last send.  Skips silently when a
     * previous store acknowledgment is still pending; the ack handler will call
     * this method again once the round-trip completes.
     */
    private doSend(): void {
        if (this.outstandingStore) {
            // Ack not yet received; the ack handler will retry once it arrives.
            return;
        }
        if (this.receivedObject === null) {
            return;
        }
        const currentFrontend = this.configurationService.serializeForBackend();
        const currentJson = JSON.stringify(currentFrontend);
        if (currentJson === this.lastSentFrontendJson) {
            return;
        }
        const configurationPayload =
            this.receivedPayload['configuration'] &&
            typeof this.receivedPayload['configuration'] === 'object' &&
            !Array.isArray(this.receivedPayload['configuration'])
                ? (this.receivedPayload['configuration'] as Record<string, unknown>)
                : {};
        const payload = {
            ...this.receivedPayload,
            configuration: {
                ...configurationPayload,
                frontend: currentFrontend,
            },
        };
        this.sendMessage(new StoreMessage(this.receivedObject, this.receivedIndex, payload));
        this.lastSentFrontendJson = currentJson;
        this.outstandingStore = true;
    }
}

@Injectable({
    providedIn: 'root',
})
export class ConfigurationStateService {
    constructor(connectionService: ConnectionService) {
        new ConfigurationConnectionClient(connectionService, this).connect();
    }
    // Client key format guide:
    // - Object property: "navigation.sidebar.width"
    // - Array item with selectors: "navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size"
    // Selectors identify one array item and can appear in any order; keys are normalized alphabetically.
    // New config fields should follow this key grammar so backend payload conversion works without service changes.
    private readonly configItemsSubject = new BehaviorSubject<Map<string, unknown>>(new Map());
    private readonly itemSubjects = new Map<string, BehaviorSubject<unknown | undefined>>();

    readonly configItems$ = this.configItemsSubject.asObservable();

    /** Returns the current value for the given structured key, or undefined if not set. */
    getItem<T>(key: string): T | undefined {
        if (!key) {
            return undefined;
        }

        return this.configItemsSubject.value.get(key) as T | undefined;
    }

    /**
     * Returns an Observable that emits the current value for `key` immediately
     * and again on every subsequent change.  The same subject is reused across
     * calls for the same key.
     */
    observeItem<T>(key: string): Observable<T | undefined> {
        if (!key) {
            return new BehaviorSubject<T | undefined>(undefined).asObservable();
        }

        const existingSubject = this.itemSubjects.get(key);
        if (existingSubject) {
            return existingSubject.asObservable() as Observable<T | undefined>;
        }

        const nextSubject = new BehaviorSubject<unknown | undefined>(
            this.configItemsSubject.value.get(key)
        );
        this.itemSubjects.set(key, nextSubject);
        return nextSubject.asObservable() as Observable<T | undefined>;
    }

    /**
     * Sets `key` to `value` in the configuration store.
     * When `defaultValue` is provided and equals `value`, the entry is removed
     * instead (treat default == absent).  No-ops if the stored value is already
     * identical (by `Object.is`).
     */
    setItem(key: string, value: unknown, defaultValue?: unknown): void {
        if (!key) {
            return;
        }

        const currentMap = this.configItemsSubject.value;

        if (arguments.length >= 3 && value === defaultValue) {
            if (!currentMap.has(key)) {
                return;
            }

            const nextMap = new Map(currentMap);
            nextMap.delete(key);
            this.configItemsSubject.next(nextMap);
            this.emitItemValue(key, undefined);
            return;
        }

        if (currentMap.has(key) && Object.is(currentMap.get(key), value)) {
            return;
        }

        const nextMap = new Map(currentMap);
        nextMap.set(key, value);
        console.log('Setting config item', { key, value, defaultValue }, 'next map', nextMap);
        this.configItemsSubject.next(nextMap);
        this.emitItemValue(key, value);
    }

    /** Removes the entry for `key` from the configuration store.  No-ops if absent. */
    removeItem(key: string): void {
        if (!key) {
            return;
        }

        const currentMap = this.configItemsSubject.value;
        if (!currentMap.has(key)) {
            return;
        }

        const nextMap = new Map(currentMap);
        nextMap.delete(key);
        this.configItemsSubject.next(nextMap);
        this.emitItemValue(key, undefined);
    }

    /**
     * Converts the flat key→value store back into the nested JSON object that
     * the backend expects as `payload.configuration.frontend`.
     * Structured keys (e.g. `navigation.sublists(bo=Invoice,...).size`) are
     * expanded into nested objects / selector-matched arrays.
     */
    serializeForBackend(): BackendConfigurationPayload {
        const payload: BackendConfigurationPayload = {};

        for (const [key, value] of this.configItemsSubject.value.entries()) {
            const segments = this.parseStructuredKey(key);
            if (!segments || segments.length === 0) {
                continue;
            }

            this.assignByStructuredKey(payload, segments, value);
        }

        return payload;
    }

    /**
     * Replaces the entire configuration store with the data received from the
     * backend.  Accepts either a nested JSON object (current format) or a legacy
     * `{key, value}[]` array.  Emits only when the resulting map actually
     * differs from the current state.
     */
    loadFromBackend(entries: unknown): void {
        // if (Array.isArray(entries)) {
        //     this.loadFromLegacyEntries(entries);
        //     return;
        // }

        if (!entries || typeof entries !== 'object') {
            return;
        }

        const nextMap = this.flattenPayload(entries as BackendConfigurationPayload);
        console.log('Loading configuration from backend', { entries }, 'next map', nextMap);
        console.log('Current map', this.configItemsSubject.value);

        if (this.areMapsEqual(this.configItemsSubject.value, nextMap)) {
            console.log('No changes detected in backend configuration, skipping update');
            return;
        }

        console.log('Updating configuration', { nextMap });
        this.configItemsSubject.next(nextMap);
        this.syncItemSubjects(nextMap);
    }

    /** Handles the legacy `{key, value}[]` array format produced by older backends. */
    // private loadFromLegacyEntries(entries: unknown[]): void {
    //     if (!Array.isArray(entries)) {
    //         return;
    //     }

    //     const nextMap = new Map<string, unknown>();

    //     for (const entry of entries) {
    //         if (!entry || typeof entry !== 'object') {
    //             continue;
    //         }

    //         const candidate = entry as Partial<ConfigurationEntry>;
    //         if (typeof candidate.key !== 'string') {
    //             continue;
    //         }

    //         nextMap.set(candidate.key, candidate.value);
    //     }

    //     if (this.areMapsEqual(this.configItemsSubject.value, nextMap)) {
    //         return;
    //     }

    //     this.configItemsSubject.next(nextMap);
    //     this.syncItemSubjects(nextMap);
    // }

    /**
     * Parses a structured key string into an ordered list of path segments.
     * Each segment carries the property name and an optional selector map that
     * identifies an array entry (e.g. `bo=Invoice,parent_bo=Customer`).
     * Returns undefined when the key is syntactically invalid.
     */
    private parseStructuredKey(key: string): StructuredKeySegment[] | undefined {
        const rawSegments = this.splitStructuredKey(key);
        if (rawSegments.length === 0) {
            return undefined;
        }

        const parsedSegments: StructuredKeySegment[] = [];
        for (const rawSegment of rawSegments) {
            const match = rawSegment.match(/^([^().]+?)(?:\((.*)\))?$/);
            if (!match) {
                return undefined;
            }

            const property = match[1].trim();
            if (!property) {
                return undefined;
            }

            const selectors: Record<string, string> = {};
            const selectorText = match[2];
            if (typeof selectorText === 'string' && selectorText.trim().length > 0) {
                const selectorParts = selectorText.split(',');
                for (const part of selectorParts) {
                    const trimmedPart = part.trim();
                    if (!trimmedPart) {
                        continue;
                    }

                    const separatorIndex = trimmedPart.indexOf('=');
                    if (separatorIndex <= 0 || separatorIndex >= trimmedPart.length - 1) {
                        return undefined;
                    }

                    const selectorKey = decodeURIComponent(
                        trimmedPart.slice(0, separatorIndex).trim()
                    );
                    const selectorValue = decodeURIComponent(
                        trimmedPart.slice(separatorIndex + 1).trim()
                    );

                    if (!selectorKey) {
                        return undefined;
                    }

                    selectors[selectorKey] = selectorValue;
                }
            }

            parsedSegments.push({ property, selectors });
        }

        return parsedSegments;
    }

    /**
     * Splits a structured key on `.` characters that are not inside a selector
     * parenthesis block, e.g. `a.b(x=1,y=2).c` → `['a', 'b(x=1,y=2)', 'c']`.
     */
    private splitStructuredKey(key: string): string[] {
        const segments: string[] = [];
        let depth = 0;
        let segmentStart = 0;

        for (let i = 0; i < key.length; i += 1) {
            const char = key[i];

            if (char === '(') {
                depth += 1;
                continue;
            }

            if (char === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }

            if (char === '.' && depth === 0) {
                const segment = key.slice(segmentStart, i).trim();
                if (segment) {
                    segments.push(segment);
                }
                segmentStart = i + 1;
            }
        }

        const tailSegment = key.slice(segmentStart).trim();
        if (tailSegment) {
            segments.push(tailSegment);
        }

        return segments;
    }

    /**
     * Writes `value` into `target` by following the structured key path.
     * Plain segments traverse / create nested objects; selector segments
     * locate or create a matching entry in an array and write to its `value`
     * property (or continue traversal for non-terminal segments).
     */
    private assignByStructuredKey(
        target: BackendConfigurationPayload,
        segments: StructuredKeySegment[],
        value: unknown
    ): void {
        let cursor: Record<string, unknown> = target;

        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            const isLast = i === segments.length - 1;

            if (Object.keys(segment.selectors).length === 0) {
                if (isLast) {
                    cursor[segment.property] = value;
                    return;
                }

                const existingValue = cursor[segment.property];
                if (!this.isRecord(existingValue)) {
                    cursor[segment.property] = {};
                }
                cursor = cursor[segment.property] as Record<string, unknown>;
                continue;
            }

            const existingArray = cursor[segment.property];
            if (!Array.isArray(existingArray)) {
                cursor[segment.property] = [];
            }

            const targetArray = cursor[segment.property] as unknown[];
            let item = targetArray.find((candidate) => this.matchesSelectors(candidate, segment));

            if (!item || !this.isRecord(item)) {
                item = {};
                for (const [selectorKey, selectorValue] of Object.entries(segment.selectors)) {
                    (item as Record<string, unknown>)[selectorKey] = selectorValue;
                }
                targetArray.push(item);
            }

            if (isLast) {
                (item as Record<string, unknown>)['value'] = value;
                return;
            }

            cursor = item as Record<string, unknown>;
        }
    }

    /** Returns true when all selector key/value pairs in `segment` match the candidate object. */
    private matchesSelectors(candidate: unknown, segment: StructuredKeySegment): boolean {
        if (!this.isRecord(candidate)) {
            return false;
        }

        for (const [selectorKey, selectorValue] of Object.entries(segment.selectors)) {
            if (String(candidate[selectorKey]) !== selectorValue) {
                return false;
            }
        }

        return true;
    }

    /** Entry point for flattening a nested backend payload into the flat key→value Map. */
    private flattenPayload(payload: BackendConfigurationPayload): Map<string, unknown> {
        const flattenedMap = new Map<string, unknown>();
        this.flattenNode(payload, [], flattenedMap);
        return flattenedMap;
    }

    /**
     * Recursively walks `node`, building a structured key from `path` for every
     * leaf value (string / number / boolean / null) and inserting it into `target`.
     * Array entries are expanded using the primitive sibling fields of each item
     * as selectors; a positional `index` selector is used as fallback.
     */
    private flattenNode(
        node: unknown,
        path: StructuredKeySegment[],
        target: Map<string, unknown>
    ): void {
        console.log('Flattening node', { node, path, target });
        if (this.isLeafValue(node)) {
            if (path.length === 0) {
                return;
            }

            target.set(this.buildStructuredKey(path), node);
            return;
        }

        if (!this.isRecord(node)) {
            return;
        }

        for (const [property, value] of Object.entries(node)) {
            console.log('Flattening property', { property, value, path, target });
            if (Array.isArray(value)) {
                value.forEach((entry, index) => {
                    if (!this.isRecord(entry)) {
                        this.flattenNode(
                            entry,
                            [...path, { property, selectors: { index: String(index) } }],
                            target
                        );
                        return;
                    }

                    const primitiveFields = Object.entries(entry).filter(([, fieldValue]) =>
                        this.isLeafValue(fieldValue)
                    );

                    for (const [entryProperty, entryValue] of Object.entries(entry)) {
                        const selectors: Record<string, string> = {};

                        for (const [primitiveKey, primitiveValue] of primitiveFields) {
                            if (primitiveKey === entryProperty) {
                                continue;
                            }

                            selectors[primitiveKey] = String(primitiveValue);
                        }

                        if (Object.keys(selectors).length === 0) {
                            selectors['index'] = String(index);
                        }

                        this.flattenNode(
                            entryValue,
                            [
                                ...path,
                                { property, selectors },
                                { property: entryProperty, selectors: {} },
                            ],
                            target
                        );
                    }
                });
                continue;
            }

            this.flattenNode(value, [...path, { property, selectors: {} }], target);
        }
    }

    /**
     * Serializes a segment path back into the canonical structured key string,
     * sorting selector pairs alphabetically so key comparisons are order-independent.
     */
    private buildStructuredKey(path: StructuredKeySegment[]): string {
        return path
            .map((segment) => {
                const selectorEntries = Object.entries(segment.selectors).sort(([left], [right]) =>
                    left.localeCompare(right)
                );

                if (selectorEntries.length === 0) {
                    return segment.property;
                }

                const selectorText = selectorEntries
                    .map(
                        ([key, value]) =>
                            `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
                    )
                    .join(',');

                return `${segment.property}(${selectorText})`;
            })
            .join('.');
    }

    /** Returns true for primitive types that are stored as leaf values in the config tree. */
    private isLeafValue(value: unknown): value is string | number | boolean | null {
        if (value === null) {
            return true;
        }

        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    }

    /** Returns true when `value` is a plain (non-array) object. */
    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    /** Performs a shallow equality check on two string→unknown Maps. */
    private areMapsEqual(left: Map<string, unknown>, right: Map<string, unknown>): boolean {
        if (left.size !== right.size) {
            return false;
        }

        for (const [key, value] of left.entries()) {
            if (!right.has(key) || !Object.is(value, right.get(key))) {
                return false;
            }
        }

        return true;
    }

    /** Pushes a new value to the per-key BehaviorSubject if one exists for `key`. */
    private emitItemValue(key: string, value: unknown | undefined): void {
        const existingSubject = this.itemSubjects.get(key);
        if (existingSubject) {
            existingSubject.next(value);
        }
    }

    /** Pushes the current map value (or undefined) to every active per-key BehaviorSubject. */
    private syncItemSubjects(currentMap: Map<string, unknown>): void {
        for (const [key, subject] of this.itemSubjects.entries()) {
            subject.next(currentMap.get(key));
        }
    }
}
