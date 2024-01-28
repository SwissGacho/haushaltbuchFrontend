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
    private token: string  | null = null;

    // Sends a message to the backend.
    sendMessage(message: Message) {
        console.log("Sending message:", message);
        if (this.token == null) {
            console.error("Cannot send message without token. Did you forget to wait for the HelloMessage?", message);
            return;
        }
        if (this.componentID == null) {
            throw new Error("Cannot send message without componentID. The componentID should be set in the ngOnInit method.");
        }
        message.token = this.token;
        this.connectionService.sendMessage(this.componentID, message);
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
        const [connection, componentID] = this.connectionService.getNewConnection();
        this.connection = connection;
        this.componentID = componentID;
        const helloSubscription = this.connection.subscribe({
            next: (message) => {
                // The first message received from the backend should be a HelloMessage with a token.
                const helloMessage = ConnectedComponent.createHelloMessage(message);
                if (helloMessage != null) {
                    console.log("Received HelloMessage:", helloMessage);
                    this.token = message.token;
                    this.connection.subscribe({
                        next: (message) => this.handleMessages(message)
                    });
                    helloSubscription.unsubscribe();
                } else {
                    console.error("Received invalid HelloMessage:", helloMessage);
                }
            },
            error: (error) => this.handleError(error),
            complete: () => this.handleComplete()
        });
    }

    private static createHelloMessage(json: string): HelloMessage | null {
        console.log("Trying to create a HelloMessage from JSON:", json);
        try {
          const jsonObject = json as any;
    
          if ('type' in jsonObject && jsonObject.type === MessageType.Hello &&
              'token' in jsonObject) {
            return new HelloMessage(jsonObject.token, jsonObject.status);
          } else {
            return null;
          }
        } catch (error) {
          console.error("Failed to parse JSON:", error);
          return null;
        }
      }
}
