

import { Component, Input, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage } from '../messages/Message';
import { BoIdentifier } from '../business-object/bo.identifier';
import { SelectedObjectService } from 'src/app/selected-object.service';

@Component({
    selector: 'app-create-object-button',
    templateUrl: './create-object-button.component.html',
    styleUrls: ['./create-object-button.component.css'],
    standalone: false
})
export class CreateObjectButtonComponent extends ConnectedComponent implements OnInit {
    constructor(protected override connectionService: ConnectionService, private selectedObjectService: SelectedObjectService) {
        super(connectionService);
        this.setComponentID('CreateObjectButton');
    }

    @Input() objectType: string = '';

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, "received", message.type, "message");
        console.warn(`${this.componentID} received unexpected message`, message);
        console.groupEnd();
    }

    onButtonClick(): void {
        let blankObject = new BoIdentifier(this.objectType, undefined);
        console.log('Creating new object with identifier', blankObject);
        this.selectedObjectService.selectObject(blankObject);
    }
}
