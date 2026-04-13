import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { BoIdentifier } from 'src/app/business-object/bo.identifier';
import { ConnectedComponent } from 'src/app/connected-component/connected.component';
import { ConnectionService } from 'src/app/connection.service';
import { FetchList, ObjectList, ListObject } from 'src/app/messages/data.messages';
import { IncomingMessage, MessageType } from 'src/app/messages/Message';
import { SelectedObjectService } from 'src/app/selected-object.service';

@Component({
    selector: 'app-header-sublist',
    templateUrl: './header-sublist.component.html',
    styleUrls: ['./header-sublist.component.css'],
    standalone: false
})
export class HeaderSublistComponent extends ConnectedComponent implements OnInit {

    constructor(protected override connectionService: ConnectionService, private selectedObjectService: SelectedObjectService) {
        super(connectionService);
        this.setComponentID('Sublist');
    }

    objects: ListObject[] = [];
    expandedObject: BoIdentifier | null = null;
    private clickTimeoutId: number | null = null;

    override OBSERVE_HANDSHAKE = true;

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.Welcome) {
            console.log('Received welcome', message);
            this.token = message.token;
            this.fetchList();
        }
        else if (message.type === MessageType.ObjectList) {
            let cast = message as ObjectList;
            console.log(`Received object list for header ${this.header}`, cast);
            this.objects = cast.objects;
        }
        else if (message.type !== MessageType.Hello) {
            console.error('Unexpected message', message);
        }
        console.groupEnd();
    }

    fetchList() {
        if(this.token === null) {
            console.error('No token available');
            return;
        }
        const { objectType, referenceAttribute } = this.parseHeader(this.header);
        let conditions: Record<string, unknown> | undefined;

        if (referenceAttribute && this.parentObject?.id !== undefined) {
            conditions = { [referenceAttribute]: this.parentObject.id };
        }

        console.log(`Fetching list for header ${this.header}`, conditions);
        let message = new FetchList(objectType, undefined, this.token, conditions);
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
        let id: BoIdentifier = new BoIdentifier(objectType, objectId);
        this.selectedObjectService.selectObject(id);
    }

    onCreateNew(): void {
        const { objectType } = this.parseHeader(this.header);
        let blankObject = new BoIdentifier(objectType, undefined);
        this.selectedObjectService.selectObject(blankObject);
    }

    override ngOnDestroy(): void {
        this.clearPendingClick();
        super.ngOnDestroy();
    }

    private toggleExpandedObject(objectId: number): void {
        const { objectType } = this.parseHeader(this.header);
        if (this.expandedObject?.id === objectId && this.expandedObject.type === objectType) {
            this.expandedObject = null;
            return;
        }

        this.expandedObject = new BoIdentifier(objectType, objectId);
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
