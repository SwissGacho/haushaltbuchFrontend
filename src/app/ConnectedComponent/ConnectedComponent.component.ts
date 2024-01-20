import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ConnectionService } from '../connection-service.service';

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
    
    private componentID: string = '';
    private connection!: Observable<any>;

    // Sends a message to the backend.
    sendMessage(message: Object) {
        this.connectionService.sendMessage(this.componentID, message);
    }

    /// This method closes the connection to the backend when the component is destroyed.
    ngOnDestroy(): void {
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
        const [connection, componentID] = this.connectionService.getNewConnection();
        this.connection = connection;
        this.componentID = componentID;
        this.connection.subscribe({
            next: (message) => this.handleMessages(message),
            error: (error) => this.handleError(error),
            complete: () => this.handleComplete()
        });
        }
}
