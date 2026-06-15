import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfigurationEntry {
    key: string;
    value: unknown;
}

export type BackendConfigurationPayload = Record<string, unknown>;

interface StructuredKeySegment {
    property: string;
    selectors: Record<string, string>;
}

@Injectable({
    providedIn: 'root',
})
export class ConfigurationStateService {
    // Client key format guide:
    // - Object property: "navigation.sidebar.width"
    // - Array item with selectors: "navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size"
    // Selectors identify one array item and can appear in any order; keys are normalized alphabetically.
    // New config fields should follow this key grammar so backend payload conversion works without service changes.
    private readonly configItemsSubject = new BehaviorSubject<Map<string, unknown>>(new Map());
    private readonly itemSubjects = new Map<string, BehaviorSubject<unknown | undefined>>();

    readonly configItems$ = this.configItemsSubject.asObservable();

    getItem<T>(key: string): T | undefined {
        if (!key) {
            return undefined;
        }

        return this.configItemsSubject.value.get(key) as T | undefined;
    }

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

    loadFromBackend(entries: unknown): void {
        if (Array.isArray(entries)) {
            this.loadFromLegacyEntries(entries);
            return;
        }

        if (!entries || typeof entries !== 'object') {
            return;
        }

        const nextMap = this.flattenPayload(entries as BackendConfigurationPayload);

        if (this.areMapsEqual(this.configItemsSubject.value, nextMap)) {
            return;
        }

        this.configItemsSubject.next(nextMap);
        this.syncItemSubjects(nextMap);
    }

    private loadFromLegacyEntries(entries: unknown[]): void {
        if (!Array.isArray(entries)) {
            return;
        }

        const nextMap = new Map<string, unknown>();

        for (const entry of entries) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }

            const candidate = entry as Partial<ConfigurationEntry>;
            if (typeof candidate.key !== 'string') {
                continue;
            }

            nextMap.set(candidate.key, candidate.value);
        }

        if (this.areMapsEqual(this.configItemsSubject.value, nextMap)) {
            return;
        }

        this.configItemsSubject.next(nextMap);
        this.syncItemSubjects(nextMap);
    }

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

    private flattenPayload(payload: BackendConfigurationPayload): Map<string, unknown> {
        const flattenedMap = new Map<string, unknown>();
        this.flattenNode(payload, [], flattenedMap);
        return flattenedMap;
    }

    private flattenNode(
        node: unknown,
        path: StructuredKeySegment[],
        target: Map<string, unknown>
    ): void {
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

    private isLeafValue(value: unknown): value is string | number | boolean | null {
        if (value === null) {
            return true;
        }

        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

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

    private emitItemValue(key: string, value: unknown | undefined): void {
        const existingSubject = this.itemSubjects.get(key);
        if (existingSubject) {
            existingSubject.next(value);
        }
    }

    private syncItemSubjects(currentMap: Map<string, unknown>): void {
        for (const [key, subject] of this.itemSubjects.entries()) {
            subject.next(currentMap.get(key));
        }
    }
}
