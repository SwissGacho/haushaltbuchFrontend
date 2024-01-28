import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
    providedIn: 'root'
})


/// This Service manages all WebSocket connections to the backend.
/// It provides new connections to components that need them, and manages the connections.
/// Components should call the getNewConnection method to get a new connection.
/// They should also call the removeConnection method when they are done with the connection.
export class ConnectionService {

    constructor() { }

    BACKEND_ADDRESS = 'ws://localhost:8765/'
    private connections: { [componentId: string]: WebSocketSubject<any> } = {};
    componentCounter: number = 0;

    // Create a new connection and return it.
    // Users of the connection must provide the returned componentID when sending messages.
    getNewConnection(): [Observable<any>, string] {
        let connection = new WebSocketSubject<any>(this.BACKEND_ADDRESS);
        const componentID = this.generateComponentId();
        this.connections[componentID] = connection;
        return [connection, componentID];
    }

    // Send a message to the backend.
    sendMessage(senderComponentID: string, message: Object) {
        let connection = this.connections[senderComponentID];
        connection.next(message);
    }

    // Remove a connection when a component is done with it.
    removeConnection(componentId: string): void {
        const connection = this.connections[componentId];
        if (connection) {
            connection.complete();
            delete this.connections[componentId];
        }
    }
    
    // Generate and return a unique component identifier.
    private generateComponentId(): string {
        const componentId = `component-${this.componentCounter}`;
        this.componentCounter++;
        return componentId;
    }
}