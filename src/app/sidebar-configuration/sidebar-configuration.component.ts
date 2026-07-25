import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { combineLatest, debounceTime, Subscription } from 'rxjs';
import { ConfigurationStateService } from '../configuration-state.service';
import { NavigationHeader, NavigationHeadersService } from '../navigation-headers.service';

export interface HeaderConfigEntry {
    name: string;
    displayName: string;
    isCurrentlyActive: boolean;
    expanded: boolean;
    hidden: boolean;
}

interface RawEntry extends HeaderConfigEntry {
    order: number;
}

@Component({
    selector: 'app-sidebar-configuration',
    templateUrl: './sidebar-configuration.component.html',
    styleUrls: ['./sidebar-configuration.component.css'],
    standalone: false,
})
export class SidebarConfigurationComponent implements OnInit, OnDestroy {
    @Output() close = new EventEmitter<void>();

    visibleEntries: HeaderConfigEntry[] = [];
    hiddenEntries: HeaderConfigEntry[] = [];

    private subscription: Subscription | null = null;
    private readonly HEADER_KEY_RE = /^navigation\.headers\.([^.]+)\.(order|expanded|hidden)$/;

    constructor(
        private readonly configService: ConfigurationStateService,
        private readonly navigationHeadersService: NavigationHeadersService
    ) {}

    ngOnInit(): void {
        this.subscription = combineLatest([
            this.configService.configItems$,
            this.navigationHeadersService.headers$,
        ])
            .pipe(debounceTime(0))
            .subscribe(([configMap, activeHeaders]) => {
                this.rebuildEntries(configMap, activeHeaders);
            });
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
    }

    private getBoolean(
        configMap: Map<string, unknown>,
        key: string,
        defaultValue: boolean
    ): boolean {
        const val = configMap.get(key);
        return typeof val === 'boolean' ? val : defaultValue;
    }

    private getNumber(configMap: Map<string, unknown>, key: string): number | undefined {
        const val = configMap.get(key);
        return typeof val === 'number' ? val : undefined;
    }

    private rebuildEntries(
        configMap: Map<string, unknown>,
        activeHeaders: NavigationHeader[]
    ): void {
        const configHeaderNames = new Set<string>();
        for (const key of configMap.keys()) {
            const match = key.match(this.HEADER_KEY_RE);
            if (match) {
                configHeaderNames.add(match[1]);
            }
        }

        const activeHeaderMap = new Map<string, NavigationHeader>(
            activeHeaders.map((h) => [h.name, h])
        );
        const allHeaderNames = new Set<string>([
            ...configHeaderNames,
            ...activeHeaders.map((h) => h.name),
        ]);

        const entries: RawEntry[] = [];
        for (const name of allHeaderNames) {
            const activeHeader = activeHeaderMap.get(name);
            const displayName = activeHeader?.displayName ?? name;
            const isCurrentlyActive = activeHeaderMap.has(name);
            const expanded = this.getBoolean(
                configMap,
                `navigation.headers.${name}.expanded`,
                true
            );
            const hidden = this.getBoolean(configMap, `navigation.headers.${name}.hidden`, false);
            const order = this.getNumber(configMap, `navigation.headers.${name}.order`) ?? Infinity;

            entries.push({ name, displayName, isCurrentlyActive, expanded, hidden, order });
        }

        entries.sort((a, b) => {
            if (a.order === b.order) return 0;
            return a.order - b.order;
        });

        this.visibleEntries = entries.filter((e) => !e.hidden);
        this.hiddenEntries = entries.filter((e) => e.hidden);
    }

    moveUp(index: number): void {
        if (index <= 0) return;
        [this.visibleEntries[index - 1], this.visibleEntries[index]] = [
            this.visibleEntries[index],
            this.visibleEntries[index - 1],
        ];
        this.visibleEntries = [...this.visibleEntries];
        this.persistOrder();
    }

    moveDown(index: number): void {
        if (index >= this.visibleEntries.length - 1) return;
        [this.visibleEntries[index], this.visibleEntries[index + 1]] = [
            this.visibleEntries[index + 1],
            this.visibleEntries[index],
        ];
        this.visibleEntries = [...this.visibleEntries];
        this.persistOrder();
    }

    toggleExpanded(entry: HeaderConfigEntry): void {
        const newExpanded = !entry.expanded;
        // true is the default (expanded) — remove key when reverting to default
        this.configService.setItem(`navigation.headers.${entry.name}.expanded`, newExpanded, true);
    }

    makeHidden(index: number): void {
        const entry = { ...this.visibleEntries[index], hidden: true };
        this.visibleEntries = [
            ...this.visibleEntries.slice(0, index),
            ...this.visibleEntries.slice(index + 1),
        ];
        this.hiddenEntries = [...this.hiddenEntries, entry];
        this.persistAll();
    }

    makeVisible(index: number): void {
        const entry = { ...this.hiddenEntries[index], hidden: false };
        this.hiddenEntries = [
            ...this.hiddenEntries.slice(0, index),
            ...this.hiddenEntries.slice(index + 1),
        ];
        this.visibleEntries = [...this.visibleEntries, entry];
        this.persistAll();
    }

    private persistOrder(): void {
        [...this.visibleEntries, ...this.hiddenEntries].forEach((entry, index) => {
            this.configService.setItem(`navigation.headers.${entry.name}.order`, index);
        });
    }

    private persistAll(): void {
        [...this.visibleEntries, ...this.hiddenEntries].forEach((entry, index) => {
            const prefix = `navigation.headers.${entry.name}`;
            this.configService.setItem(`${prefix}.order`, index);
            // true is the default for expanded — remove key when equal to default
            this.configService.setItem(`${prefix}.expanded`, entry.expanded, true);
            // false is the default for hidden — remove key when equal to default
            this.configService.setItem(`${prefix}.hidden`, entry.hidden, false);
        });
    }

    onClose(): void {
        this.close.emit();
    }
}
