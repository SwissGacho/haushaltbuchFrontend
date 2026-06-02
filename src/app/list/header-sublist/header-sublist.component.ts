import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { BoIdentifier } from 'src/app/business-object/bo.identifier';
import { ConnectedComponent } from 'src/app/connected-component/connected.component';
import { ConnectionService } from 'src/app/connection.service';
import { FetchMessage, ObjectMessage } from 'src/app/messages/data.messages';
import { ListObject } from 'src/app/messages/Message';
import { IncomingMessage, MessageType } from 'src/app/messages/Message';
import { SelectedObjectService } from 'src/app/selected-object.service';

@Component({
    selector: 'app-header-sublist',
    templateUrl: './header-sublist.component.html',
    styleUrls: ['./header-sublist.component.css'],
    standalone: false,
})
export class HeaderSublistComponent extends ConnectedComponent implements OnInit {
    private static readonly DEFAULT_VISIBLE_ITEM_COUNT = 7;

    constructor(
        protected override connectionService: ConnectionService,
        private selectedObjectService: SelectedObjectService
    ) {
        super(connectionService);
        this.setComponentID('Sublist');
    }

    objects: ListObject[] = [];
    expandedObject: BoIdentifier | null = null;
    knownEmptyIds = new Set<number>();
    private clickTimeoutId: number | null = null;

    override OBSERVE_HANDSHAKE = true;

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        if (message.type === MessageType.Welcome) {
            console.log('Received welcome', message);
            this.token = message.token;
            this.fetchList();
        } else if (message.type === MessageType.Object) {
            const cast = message as ObjectMessage;
            console.log(`Received object list for header ${this.header}`, cast);
            const expectedObject = 'bolist';
            const expectedIndex = this.parseHeader(this.header).objectType;
            if (cast.object !== expectedObject || cast.index !== expectedIndex) {
                console.warn(`${this.componentID} ignoring object message for unexpected target`, {
                    expected: { object: expectedObject, index: expectedIndex },
                    received: { object: cast.object, index: cast.index },
                });
                console.groupEnd();
                return;
            }

            if (!Array.isArray(cast.payload?.objects)) {
                console.error(
                    `${this.componentID} received invalid Object payload; expected objects array`,
                    cast.payload
                );
                this.objects = [];
                console.groupEnd();
                return;
            }

            this.objects = cast.payload.objects;
        } else if (message.type !== MessageType.Hello) {
            console.error('Unexpected message', message);
        }
        console.groupEnd();
    }

    fetchList() {
        if (this.token === null) {
            console.error('No token available');
            return;
        }
        const { objectType, referenceAttribute } = this.parseHeader(this.header);
        let conditions: Record<string, unknown> | undefined;

        if (referenceAttribute && this.parentObject?.id !== undefined) {
            conditions = { [referenceAttribute]: this.parentObject.id };
        }

        console.log(`Fetching list for header ${this.header}`, conditions);
        let message = new FetchMessage('bolist', objectType, this.token, conditions);
        this.sendMessage(message);
    }

    onObjectClick(objectId: number): void {
        this.clearPendingClick();
        this.clickTimeoutId = window.setTimeout(() => {
            this.toggleExpandedObject(objectId);
            this.clickTimeoutId = null;
        }, 250);
    }

    onObjectDoubleClick(objectId: number): void {
        this.clearPendingClick();
        const { objectType } = this.parseHeader(this.header);
        const objectDisplayName = this.findObjectDisplayName(objectId);
        let id: BoIdentifier = new BoIdentifier(objectType, objectId, undefined, objectDisplayName);
        this.selectedObjectService.selectObject(id);
    }

    onCreateNew(): void {
        const { objectType, referenceAttribute } = this.parseHeader(this.header);
        let initialValues: Record<string, unknown> | undefined;

        if (referenceAttribute && this.parentObject?.id !== undefined) {
            initialValues = {
                [referenceAttribute]: {
                    id: this.parentObject.id,
                    display_name: this.parentObject.displayName || String(this.parentObject.id),
                    bo_type: this.parentObject.type,
                },
            };
        }

        let blankObject = new BoIdentifier(objectType, undefined, initialValues);
        this.selectedObjectService.selectObject(blankObject);
    }

    override ngOnDestroy(): void {
        this.clearPendingClick();
        super.ngOnDestroy();
    }

    onSublistEmpty(objectId: number): void {
        this.knownEmptyIds.add(objectId);
    }

    private toggleExpandedObject(objectId: number): void {
        const { objectType } = this.parseHeader(this.header);
        if (this.expandedObject?.id === objectId && this.expandedObject.type === objectType) {
            this.expandedObject = null;
            return;
        }

        const objectDisplayName = this.findObjectDisplayName(objectId);
        this.expandedObject = new BoIdentifier(objectType, objectId, undefined, objectDisplayName);
    }

    private findObjectDisplayName(objectId: number): string | undefined {
        return this.objects.find((object) => object.id === objectId)?.display_name;
    }

    private clearPendingClick(): void {
        if (this.clickTimeoutId === null) {
            return;
        }

        window.clearTimeout(this.clickTimeoutId);
        this.clickTimeoutId = null;
    }

    // An input property to receive the headers from the parent component
    @Input() header: string = '';
    @Input() parentObject: BoIdentifier | null = null;
    @Input() visibleItemCount = HeaderSublistComponent.DEFAULT_VISIBLE_ITEM_COUNT;

    get normalizedVisibleItemCount(): number {
        if (!Number.isFinite(this.visibleItemCount)) {
            return HeaderSublistComponent.DEFAULT_VISIBLE_ITEM_COUNT;
        }

        return Math.max(1, Math.floor(this.visibleItemCount));
    }

    private parseHeader(header: string): { objectType: string; referenceAttribute?: string } {
        const separatorIndex = header.indexOf('.');
        if (separatorIndex < 0) {
            return { objectType: header };
        }

        const objectType = header.slice(0, separatorIndex);
        const referenceAttribute = header.slice(separatorIndex + 1);
        return { objectType, referenceAttribute: referenceAttribute || undefined };
    }
}
