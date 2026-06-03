import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfigurationEntry {
    key: string;
    value: unknown;
}

@Injectable({
    providedIn: 'root',
})
export class ConfigurationStateService {
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

    // Intended backend payload for future save/reload integration.
    serializeForBackend(): ConfigurationEntry[] {
        return Array.from(this.configItemsSubject.value.entries()).map(([key, value]) => ({
            key,
            value,
        }));
    }

    // Intended backend payload consumer for future save/reload integration.
    loadFromBackend(entries: unknown): void {
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
