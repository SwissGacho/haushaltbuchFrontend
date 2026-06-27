import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, skip, Subscription } from 'rxjs';
import { ConnectionService, ConnectionSubscriber } from './connection.service';
import { IdentifiedComponent } from './identified.component';
import { IncomingBaseMessage, Message, MessageType } from './messages/Message';
import { FetchMessage, ObjectMessage, StoreMessage } from './messages/data.messages';
import { WelcomeMessage, ByeMessage, HelloMessage } from './messages/admin.messages';
import { recordToMap, mapToRecord } from './configuration-state.helper';

type ConfigValue = string | number | boolean | null;

export interface ConfigurationEntry {
    key: string;
    value: ConfigValue;
}

export type BackendConfigurationPayload = Record<string, unknown>;

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
    private readonly configItemsSubject = new BehaviorSubject<Map<string, ConfigValue>>(new Map());
    private readonly itemSubjects = new Map<string, BehaviorSubject<ConfigValue | undefined>>();

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

        const nextSubject = new BehaviorSubject<ConfigValue | undefined>(
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
    setItem(key: string, value: ConfigValue, defaultValue?: ConfigValue): void {
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

        return mapToRecord(this.configItemsSubject.value);
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

        // const nextMap = this.flattenPayload(entries as BackendConfigurationPayload);
        const nextMap = recordToMap(entries as BackendConfigurationPayload);
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
    private emitItemValue(key: string, value: ConfigValue | undefined): void {
        const existingSubject = this.itemSubjects.get(key);
        if (existingSubject) {
            existingSubject.next(value);
        }
    }

    /** Pushes the current map value (or undefined) to every active per-key BehaviorSubject. */
    private syncItemSubjects(currentMap: Map<string, ConfigValue>): void {
        for (const [key, subject] of this.itemSubjects.entries()) {
            subject.next(currentMap.get(key));
        }
    }
}
