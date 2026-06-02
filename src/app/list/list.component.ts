import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
} from '@angular/core';
import { ConnectionService } from '../connection.service';
import { ConnectedComponent } from '../connected-component/connected.component';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchMessage, ObjectMessage } from '../messages/data.messages';
import { BoIdentifier } from '../business-object/bo.identifier';

interface NavigationHeader {
    name: string;
    displayName: string;
}

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
export class ListComponent extends ConnectedComponent implements OnInit {
    private static readonly NAVIGATION_HEADERS_OBJECT = 'navigationheaders';

    constructor(protected override connectionService: ConnectionService) {
        super(connectionService);
        this.setComponentID('NavigationHeaders');
    }

    // A list of headers with machine-readable and display values.
    headers: NavigationHeader[] = [];
    private readonly expandedHeaders = new Set<string>();

    @Input() parentObject: BoIdentifier | null = null;
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
                this.headers = [];
                this.empty.emit();
                console.groupEnd();
                return;
            }

            this.headers = incomingHeaders
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

    isHeaderExpanded(headerName: string): boolean {
        return this.expandedHeaders.has(headerName);
    }

    toggleHeader(headerName: string): void {
        if (this.expandedHeaders.has(headerName)) {
            this.expandedHeaders.delete(headerName);
            return;
        }

        this.expandedHeaders.add(headerName);
    }

    private syncExpandedHeaders(): void {
        const knownHeaderNames = new Set(this.headers.map((header) => header.name));

        for (const expandedHeader of this.expandedHeaders) {
            if (!knownHeaderNames.has(expandedHeader)) {
                this.expandedHeaders.delete(expandedHeader);
            }
        }

        for (const header of this.headers) {
            if (!this.expandedHeaders.has(header.name)) {
                this.expandedHeaders.add(header.name);
            }
        }
    }
}
