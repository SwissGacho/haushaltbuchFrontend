

import { Component, OnInit } from '@angular/core';
import { ConnectionService } from '../connection.service';
import { ConnectedComponent } from '../connected-component/connected.component';
import { IncomingMessage, MessageType } from '../messages/Message';
import { FetchNavigationHeaders, NavigationHeaders } from '../messages/data.messages';

@Component({
    selector: 'app-list-component',
    templateUrl: './list.component.html',
    styleUrls: ['./list.component.css']
})
export class ListComponent extends ConnectedComponent implements OnInit {

    constructor(protected override connectionService: ConnectionService) {
        super(connectionService);
        this.setComponentID('NavigationHeaders');
    }

    // A list of the headers we received
    headers: string[] = [];

    override OBSERVE_HANDSHAKE = true;

    override handleMessages(message: IncomingMessage): void {
        console.log(this.componentID, "received", message.type, "message");
        if (message.type === MessageType.Welcome) {
            console.log('Received welcome', message);
            this.token = message.token;
            this.fetchNavigationHeaders();
        }
        else if (message.type === MessageType.NavigationHeaders) {
            console.log('Received list', message);
            this.headers = (message as NavigationHeaders).headers;
        }
        else if (message.type === MessageType.Hello) {
            console.log('Received hello', message);
        }
        else {
            // We received an unexpected or unknown message
            console.error('Unexpected message', message);
        }
    }

    fetchNavigationHeaders() {
        if(this.token === null) {
            console.error('No token available');
            return;
        }
        console.log('Fetching list');
        let message = new FetchNavigationHeaders(this.token);
        console.log('Sending fetch list message', message);
        this.sendMessage(message);
    }
}
