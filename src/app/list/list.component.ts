import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ConnectionService } from '../connection.service';
import { ConnectedComponent } from '../connected-component/connected.component';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchMessage, ObjectMessage } from '../messages/data.messages';
import { BoIdentifier } from '../business-object/bo.identifier';
import { ConfigurationStateService } from '../configuration-state.service';
import { NavigationHeader, NavigationHeadersService } from '../navigation-headers.service';

interface IncomingNavigationHeader {
    name?: unknown;
    display_name?: unknown;
}

@Component({
    selector: 'app-list-component',
    templateUrl: './list.component.html',
    styleUrls: ['./list.component.css'],
    standalone: false,
})
export class ListComponent extends ConnectedComponent implements OnInit, OnDestroy {
    private static readonly NAVIGATION_HEADERS_OBJECT = 'navigationheaders';

    constructor(
        protected override connectionService: ConnectionService,
        private readonly configurationStateService: ConfigurationStateService,
        private readonly navigationHeadersService: NavigationHeadersService
    ) {
        super(connectionService);
        this.setComponentID('NavigationHeaders');
    }

    // All headers as received from the backend (unfiltered, unsorted).
    private rawHeaders: NavigationHeader[] = [];
    // Headers after applying config-based ordering and visibility filter.
    headers: NavigationHeader[] = [];
    private readonly expandedHeaders = new Set<string>();
    // Headers the user has explicitly toggled; config changes do not override these.
    private readonly userToggledHeaders = new Set<string>();
    private configSubscription: Subscription | null = null;

    @Input() parentObject: BoIdentifier | null = null;
    @Input() sublistVisibleItemCount = 7;
    @Output() empty = new EventEmitter<void>();

    override OBSERVE_HANDSHAKE = true;

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        if (message.type === MessageType.Welcome) {
            //console.log(`${this.componentID} handling welcome`, message);
            this.token = message.token;
            this.fetchNavigationHeaders();
        } else if (message.type === MessageType.Object) {
            // Log which component received the message with format string
            const cast = message as ObjectMessage;
            console.log(`${this.componentID} handling NavigationHeaders`, message);

            const expectedObject = ListComponent.NAVIGATION_HEADERS_OBJECT;
            const expectedIndex = this.parentObject?.type || '';
            if (cast.object !== expectedObject || cast.index !== expectedIndex) {
                console.warn(`${this.componentID} ignoring object message for unexpected target`, {
                    expected: { object: expectedObject, index: expectedIndex },
                    received: { object: cast.object, index: cast.index },
                });
                console.groupEnd();
                return;
            }

            const incomingHeaders = cast.payload?.headers;
            if (!Array.isArray(incomingHeaders)) {
                console.warn(
                    `${this.componentID} received invalid headers payload; expected an array`,
                    cast.payload
                );
                this.rawHeaders = [];
                this.headers = [];
                this.navigationHeadersService.setHeaders([]);
                this.empty.emit();
                console.groupEnd();
                return;
            }

            this.rawHeaders = incomingHeaders
                .map((header: IncomingNavigationHeader) => {
                    if (typeof header?.name !== 'string' || header.name.length === 0) {
                        return null;
                    }

                    const displayName =
                        typeof header.display_name === 'string' && header.display_name.length > 0
                            ? header.display_name
                            : header.name;

                    return {
                        name: header.name,
                        displayName,
                    };
                })
                .filter((header): header is NavigationHeader => header !== null);

            this.navigationHeadersService.setHeaders(this.rawHeaders);
            this.headers = this.applyHeaderConfig(this.rawHeaders);
            this.syncExpandedHeaders();

            console.log('Extracted headers:', this.headers);
            if (this.headers.length === 0) {
                this.empty.emit();
            }
        } else if (message.type === MessageType.Hello) {
            console.log(`${this.componentID} handling hello`, message);
        } else {
            // We received an unexpected or unknown message
            console.error(`${this.componentID} handling Unexpected message`, message);
        }
        console.groupEnd();
    }

    fetchNavigationHeaders() {
        if (this.token === null) {
            console.error('No token available');
            return;
        }
        console.log('Fetching list');
        let message = new FetchMessage(
            ListComponent.NAVIGATION_HEADERS_OBJECT,
            this.parentObject?.type || '',
            this.token
        );
        console.log('Sending fetch list message', message);
        this.sendMessage(message);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['parentObject'] || this.token === null) {
            return;
        }

        this.fetchNavigationHeaders();
    }

    override ngOnInit(): void {
        super.ngOnInit();
        // Re-apply config whenever it changes so ordering, visibility and expanded state stay in sync.
        this.configSubscription = this.configurationStateService.configItems$.subscribe(() => {
            if (this.rawHeaders.length > 0) {
                this.headers = this.applyHeaderConfig(this.rawHeaders);
                this.syncExpandedHeaders();
            }
        });
    }

    override ngOnDestroy(): void {
        this.configSubscription?.unsubscribe();
        super.ngOnDestroy();
    }

    isHeaderExpanded(headerName: string): boolean {
        return this.expandedHeaders.has(headerName);
    }

    toggleHeader(headerName: string): void {
        this.userToggledHeaders.add(headerName);
        if (this.expandedHeaders.has(headerName)) {
            this.expandedHeaders.delete(headerName);
            return;
        }

        this.expandedHeaders.add(headerName);
    }

    private applyHeaderConfig(headers: NavigationHeader[]): NavigationHeader[] {
        const visible = headers.filter((h) => {
            const hidden = this.configurationStateService.getItem<boolean>(
                `navigation.headers.${h.name}.hidden`
            );
            return hidden !== true;
        });

        return visible.sort((a, b) => {
            const orderA = this.configurationStateService.getItem<number>(
                `navigation.headers.${a.name}.order`
            );
            const orderB = this.configurationStateService.getItem<number>(
                `navigation.headers.${b.name}.order`
            );
            const numA = typeof orderA === 'number' ? orderA : Infinity;
            const numB = typeof orderB === 'number' ? orderB : Infinity;
            return numA - numB;
        });
    }

    private syncExpandedHeaders(): void {
        const knownHeaderNames = new Set(this.headers.map((header) => header.name));

        for (const expandedHeader of this.expandedHeaders) {
            if (!knownHeaderNames.has(expandedHeader)) {
                this.expandedHeaders.delete(expandedHeader);
            }
        }

        for (const toggledHeader of this.userToggledHeaders) {
            if (!knownHeaderNames.has(toggledHeader)) {
                this.userToggledHeaders.delete(toggledHeader);
            }
        }

        for (const header of this.headers) {
            // Never override a header the user has explicitly toggled.
            if (this.userToggledHeaders.has(header.name)) {
                continue;
            }
            const configExpanded = this.configurationStateService.getItem<boolean>(
                `navigation.headers.${header.name}.expanded`
            );
            // Default: expanded (true) — matches previous behaviour.
            // Both add and delete so that a config change takes effect immediately.
            if (configExpanded !== false) {
                this.expandedHeaders.add(header.name);
            } else {
                this.expandedHeaders.delete(header.name);
            }
        }
    }
}
