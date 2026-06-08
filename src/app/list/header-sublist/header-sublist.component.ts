import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { BoIdentifier } from 'src/app/business-object/bo.identifier';
import { ConnectedComponent } from 'src/app/connected-component/connected.component';
import { ConnectionService } from 'src/app/connection.service';
import { FetchMessage, ObjectMessage } from 'src/app/messages/data.messages';
import { ListObject } from 'src/app/messages/Message';
import { IncomingMessage, MessageType } from 'src/app/messages/Message';
import { SelectedObjectService } from 'src/app/selected-object.service';
import { ConfigurationStateService } from 'src/app/configuration-state.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-header-sublist',
    templateUrl: './header-sublist.component.html',
    styleUrls: ['./header-sublist.component.css'],
    standalone: false,
})
export class HeaderSublistComponent extends ConnectedComponent implements OnInit, OnChanges {
    private static readonly DEFAULT_VISIBLE_ITEM_COUNT = 7;
    private static readonly MIN_VISIBLE_ITEM_COUNT = 2;
    private static readonly MAX_VISIBLE_ITEM_COUNT = 30;
    private static readonly SUBLIST_ROW_HEIGHT_PX = 30;

    constructor(
        protected override connectionService: ConnectionService,
        private selectedObjectService: SelectedObjectService,
        private configurationStateService: ConfigurationStateService
    ) {
        super(connectionService);
        this.setComponentID('Sublist');
    }

    objects: ListObject[] = [];
    expandedObject: BoIdentifier | null = null;
    knownEmptyIds = new Set<number>();
    private clickTimeoutId: number | null = null;
    private resizeMouseMoveHandler: ((event: MouseEvent) => void) | null = null;
    private resizeMouseUpHandler: (() => void) | null = null;
    private visibleItemCountSubscription: Subscription | null = null;
    private subscribedSublistSizeKey = '';
    private currentVisibleItemCount = HeaderSublistComponent.DEFAULT_VISIBLE_ITEM_COUNT;
    private showAllItems = false;

    override ngOnInit(): void {
        super.ngOnInit();
        this.syncVisibleItemCountSubscription();
    }

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

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['header'] || changes['parentObject'] || changes['visibleItemCount']) {
            this.showAllItems = false;
            this.syncVisibleItemCountSubscription();
        }
    }

    override ngOnDestroy(): void {
        this.clearPendingClick();
        this.clearResizeHandlers();
        this.clearVisibleItemCountSubscription();
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
        return this.clampVisibleItemCount(this.currentVisibleItemCount);
    }

    get visibleObjects(): ListObject[] {
        if (this.showAllItems || !this.hasOverflowingItems) {
            return this.objects;
        }

        return this.objects.slice(0, this.normalizedVisibleItemCount);
    }

    get hasOverflowingItems(): boolean {
        return this.objects.length > this.normalizedVisibleItemCount;
    }

    get hiddenObjectCount(): number {
        return Math.max(0, this.objects.length - this.visibleObjects.length);
    }

    showAllObjects(): void {
        this.showAllItems = true;
    }

    showFewerObjects(): void {
        this.showAllItems = false;
    }

    startResize(event: MouseEvent): void {
        event.preventDefault();
        this.clearResizeHandlers();
        const startY = event.clientY;
        const startCount = this.normalizedVisibleItemCount;

        this.resizeMouseMoveHandler = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaRows = Math.round(deltaY / HeaderSublistComponent.SUBLIST_ROW_HEIGHT_PX);
            this.currentVisibleItemCount = this.clampVisibleItemCount(startCount + deltaRows);
            this.persistCurrentVisibleItemCount();
        };

        this.resizeMouseUpHandler = () => {
            this.clearResizeHandlers();
        };

        window.addEventListener('mousemove', this.resizeMouseMoveHandler);
        window.addEventListener('mouseup', this.resizeMouseUpHandler);
    }

    increaseVisibleItems(): void {
        this.currentVisibleItemCount = this.clampVisibleItemCount(
            this.normalizedVisibleItemCount + 1
        );
        this.persistCurrentVisibleItemCount();
    }

    decreaseVisibleItems(): void {
        this.currentVisibleItemCount = this.clampVisibleItemCount(
            this.normalizedVisibleItemCount - 1
        );
        this.persistCurrentVisibleItemCount();
    }

    onResizeHandleKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.decreaseVisibleItems();
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.increaseVisibleItems();
        }
    }

    private clampVisibleItemCount(count: number): number {
        if (!Number.isFinite(count)) {
            return HeaderSublistComponent.DEFAULT_VISIBLE_ITEM_COUNT;
        }

        const roundedCount = Math.floor(count);
        return Math.max(
            HeaderSublistComponent.MIN_VISIBLE_ITEM_COUNT,
            Math.min(HeaderSublistComponent.MAX_VISIBLE_ITEM_COUNT, roundedCount)
        );
    }

    private clearResizeHandlers(): void {
        if (this.resizeMouseMoveHandler !== null) {
            window.removeEventListener('mousemove', this.resizeMouseMoveHandler);
            this.resizeMouseMoveHandler = null;
        }

        if (this.resizeMouseUpHandler !== null) {
            window.removeEventListener('mouseup', this.resizeMouseUpHandler);
            this.resizeMouseUpHandler = null;
        }
    }

    private persistCurrentVisibleItemCount(): void {
        this.configurationStateService.setItem(
            this.getSublistSizeKey(),
            this.normalizedVisibleItemCount,
            this.standardVisibleItemCount
        );
    }

    private syncVisibleItemCountSubscription(): void {
        const sublistSizeKey = this.getSublistSizeKey();

        if (!sublistSizeKey) {
            this.clearVisibleItemCountSubscription();
            this.currentVisibleItemCount = this.standardVisibleItemCount;
            return;
        }

        if (
            this.subscribedSublistSizeKey === sublistSizeKey &&
            this.visibleItemCountSubscription !== null
        ) {
            this.currentVisibleItemCount = this.resolveCountFromStoredValue(
                this.configurationStateService.getItem<number>(sublistSizeKey)
            );
            return;
        }

        this.clearVisibleItemCountSubscription();
        this.subscribedSublistSizeKey = sublistSizeKey;
        this.visibleItemCountSubscription = this.configurationStateService
            .observeItem<number>(sublistSizeKey)
            .subscribe((storedSize) => {
                this.currentVisibleItemCount = this.resolveCountFromStoredValue(storedSize);
            });
    }

    private clearVisibleItemCountSubscription(): void {
        if (this.visibleItemCountSubscription !== null) {
            this.visibleItemCountSubscription.unsubscribe();
            this.visibleItemCountSubscription = null;
        }

        this.subscribedSublistSizeKey = '';
    }

    private resolveCountFromStoredValue(storedSize: number | undefined): number {
        if (Number.isFinite(storedSize)) {
            return this.clampVisibleItemCount(storedSize as number);
        }

        return this.standardVisibleItemCount;
    }

    private get standardVisibleItemCount(): number {
        return this.clampVisibleItemCount(this.visibleItemCount);
    }

    private getSublistSizeKey(): string {
        if (!this.header) {
            return '';
        }

        const parentType = this.parentObject?.type || 'root';
        const parentId = this.parentObject?.id ?? 'none';
        return `sublist.size|${parentType}:${String(parentId)}|${this.header}`;
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
