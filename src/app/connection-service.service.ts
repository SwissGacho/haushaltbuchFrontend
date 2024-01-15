import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
    providedIn: 'root'
})
export class ConnectionService {

    constructor() { }

    BACKEND_ADDRESS = 'ws://localhost:8765/'
    private connections: { [componentId: string]: WebSocketSubject<any> } = {};
    componentCounter: number = 0;

    getNewConnection(): [Observable<any>, string] {
        let connection = new WebSocketSubject<any>(this.BACKEND_ADDRESS);
        const componentID = this.generateComponentId();
        this.connections[componentID] = connection;
        return [connection, componentID];
    }

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

/*
export class HelloWorldService {

    connection$?: WebSocketSubject<any>;
    BACKEND_ADDRESS = 'ws://localhost:8765/'

    connectToTest(): Observable<any> {
        return this.connect(this.BACKEND_ADDRESS);
    }

    connect(endpoint: string): Observable<any> {
        // If no connection object has been created yet, return a new connection
        if (!this.connection$) this.connection$ = webSocket(endpoint);
        return this.connection$;
    }

    getHelloWorld(): Observable<any> {
        if (!this.connection$) {
            throw new Error('No connection established!');
        }
        return this.connection$?.multiplex(
            () => ('Hello World'),
            () => ('Goodbye World'),
            (message) => true
        )
    }

    send(data: Object) {
		console.log("HelloWorldService sending message")
		console.log(data)
		if (this.connection$) {
			this.connection$.next(data);
		} else {
			console.error('Connection has not been created, cannot send ' + String(data))
		}
	}

    constructor() { }

}
*/