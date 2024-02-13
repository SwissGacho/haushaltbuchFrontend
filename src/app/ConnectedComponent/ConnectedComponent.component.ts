import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ConnectionService } from '../connection-service.service';
import { HelloMessage, Message, MessageType } from '../Message';

@Component({
    selector: 'app-ConnectedComponent',
    templateUrl: './ConnectedComponent.component.html',
    styleUrls: ['./ConnectedComponent.component.css']
})

/// This class is the base class for all components that need to send and receive messages to and from the backend.
/// It provides methods for sending messages and subscribing to incoming messages.
/// Subclasses should implement the handleMessages method to handle incoming messages, and the handleError method to handle errors.
/// If necessary, they can also implement the handleComplete method to handle the connection closing.
/// They can also call the sendMessage method to send messages.
export class ConnectedComponent implements OnInit, OnDestroy {

    constructor(private connectionService: ConnectionService) {
    }
    
    private componentID: string | null = null;
    private connection!: Observable<any>;
    protected token: string  | null = null;

    // Sends a message to the backend.
    sendMessage(message: Message) {
        console.log("Connected Component prepares to send message:", message);
        if (this.token == null) {
            console.warn("Tried to send a message before the connection token was set", message);
            return;
        }
        message.token = this.token;
        this.connectionService.sendMessage(this.token, message);
    }

    /// This method closes the connection to the backend when the component is destroyed.
    ngOnDestroy(): void {
        if (this.componentID == null) {
            return;
        }
        this.connectionService.removeConnection(this.componentID);
    }

    // Abstract method for components to implement their message handling.
    handleMessages(message: any): void {
        throw new Error('Subclasses must implement the handleMessages method.');
    }

    // Abstract method for components to implement their error handling.
    handleError(error: any): void {
        throw new Error('Subclasses must implement the handleError method.');
    }

    // Abstract method for components to implement their connection closing handling.
    handleComplete(): void {
        console.warn(`Connection closed for component ${this.componentID}.`);
    }

    // Creates the connection to the backend when the component is initialized.
    // Subclasses should call super.ngOnInit() in their ngOnInit method instead creating their own connection.
    ngOnInit() {
        this.connectionService.getNewConnection(this);
    }


      public setToken(token: string) {
        this.token = token;
      }
}
