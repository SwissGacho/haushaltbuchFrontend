import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ConnectionService } from '../connection-service.service';

@Component({
    selector: 'app-ConnectedComponent',
    templateUrl: './ConnectedComponent.component.html',
    styleUrls: ['./ConnectedComponent.component.css']
})
export class ConnectedComponent implements OnInit, OnDestroy {

    constructor(private connectionService: ConnectionService) {
    }
    
    private componentID: string = '';
    private connection!: Observable<any>;

    sendMessage(message: Object) {
        this.connectionService.sendMessage(this.componentID, message);
    }

    ngOnDestroy(): void {
        this.connectionService.removeConnection(this.componentID);
    }

    // Abstract method for components to implement their message handling.
    handleMessages(message: any): void {
        throw new Error('Subclasses must implement the handleMessages method.');
    }

    handleError(error: any): void {
        throw new Error('Subclasses must implement the handleError method.');
    }

    handleComplete(): void {
        console.warn(`Connection closed for component ${this.componentID}.`);
    }

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
