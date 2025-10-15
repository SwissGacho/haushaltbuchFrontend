

import { Component, Input, OnInit } from '@angular/core';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage } from '../messages/Message';
import { StoreMessage } from '../messages/data.messages';

@Component({
    selector: 'app-create-object-button',
    templateUrl: './create-object-button.component.html',
    styleUrls: ['./create-object-button.component.css'],
    standalone: false
})
export class CreateObjectButtonComponent extends ConnectedComponent implements OnInit {
    constructor(protected override connectionService: ConnectionService) {
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
        let message = new StoreMessage(this.objectType, null, null, this.token!);
        console.log('Sending create object message', message);
        this.sendMessage(message);
    }
}
