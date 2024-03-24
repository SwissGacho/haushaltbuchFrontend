import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, Subject, skip, take } from 'rxjs';
import { webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import { HelloMessage, LoginMessage, Message, IncomingMessage, MessageType, deserialize, WelcomeMessage, ByeMessage, LoginCredentials } from './Message';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';

@Injectable({
    providedIn: 'root'
})


/// This Service manages all WebSocket connections to the backend.
/// It provides new connections to components that need them, and manages the connections.
/// Components should call the getNewConnection method to get a new connection.
/// They should also call the removeConnection method when they are done with the connection.
export class ConnectionService {

    constructor() { }

    BACKEND_ADDRESS = 'ws://localhost:8765/';

    private static connections: { [componentId: string]: {
        subject: WebSocketSubject<Message>,
        subscriber: ConnectedComponent
    } } = {};
    private static unconnectedComponents: { 
        service: ConnectionService;
        connection: WebSocketSubject<Message>,
        subscriber: ConnectedComponent,
        loginSubject: Subject<{user?: string, ses_token?: string}>
    }[] = [];

    private static loginBySessionTokenSubject = new ReplaySubject<LoginCredentials>();
    private static _sessionToken: string = "";

    componentCounter: number = 0;

    // Create a WS Subject; used locally to allow patching in unit test
    // This method is not tested by any spec, change with utmost care
    _createWebSocketSubject(url: string, comp_num: number): WebSocketSubject<Message> {
        return webSocket({   // TODO: use rxjs.webSocket instead of new
            url: url, 
            deserializer: (e: MessageEvent) => {
                const m = deserialize(e);
                m.connection_id = comp_num;
                return m;
            }
        });
    }
    // Create a new connection and subscribe for the handshake messages (HelloMessage, WelcomeMessage).
    // Subscribe the subscriber for further messages.
    // A Subject delivering the login credentials is determined
    getNewConnection(subscriber: ConnectedComponent, loginSubject?: Subject<LoginCredentials>): void {
        let comp_num = ++this.componentCounter;
        console.log('Creating connection for component ', subscriber.componentID, '; comp#: ', comp_num);
        console.groupCollapsed(); console.log('Subscriber: ', subscriber); console.log('LoginSubject: ',loginSubject);
        let connection = this._createWebSocketSubject(this.BACKEND_ADDRESS, comp_num);
        ConnectionService.unconnectedComponents[comp_num] = {
            service: this,
            connection: connection,
            subscriber: subscriber,
            // use either credentials from the subscriber or the local session token:
            loginSubject: loginSubject || ConnectionService.loginBySessionTokenSubject
        };
        connection.pipe(take(2)).subscribe({next: this.handleHandshakeMessages});
        connection.pipe(skip(2)).subscribe({next: subscriber.handleMessages, complete: subscriber.handleComplete});
        console.groupEnd();
    }
    
    // Handle the first two messages from a new connection, it should be a HelloMessage and a WelcomeMessage
    // If the session token is not set yet, assume we receive it after successfull logon by 
    // LoginComponent and send the ses_token through the sessionTokenSubject
    handleHandshakeMessages(message: Message) {
        console.log('handle handshake: ', message.type, '; comp#: ', message.connection_id);
        console.groupCollapsed(); console.log( message); console.log(this);
        console.groupEnd();
        if (message instanceof HelloMessage && message.connection_id>0) {
            const comp = ConnectionService.unconnectedComponents[message.connection_id];
            if (comp) {
                console.log('attach token ', message.token, ' to component ', comp.subscriber.componentID)
                ConnectionService.addConnection(message.token, comp.connection, comp.subscriber);
                comp.loginSubject.pipe(take(1)).subscribe(
                    (credentials: LoginCredentials) => {
                        console.log('Got credentials: ', credentials);
                        comp.service.sendMessage(new LoginMessage(credentials, message.token));
                    }
                )
            }
        } else if (message instanceof WelcomeMessage) {
            // if the session token is not set yet provide it for other connections
            if (message.ses_token && ! ConnectionService._sessionToken ) {
                ConnectionService._sessionToken = message.ses_token;
                ConnectionService.loginBySessionTokenSubject.next({ses_token: message.ses_token});
            }
        } else 
        if (message instanceof ByeMessage) {
            console.error('Logon failed');
        }
    }

    // Send a message to the backend.
    sendMessage(message: Message, token?: string) {
        if (token) {
            message.token = token;
        }
        let connection = ConnectionService.connections[message.token].subject;
        console.log("Sending message", message);
        connection.next(message);
    }

    // Associate a connection token to the WS connection und the subscribing component
    static addConnection(token: string, subject: WebSocketSubject<Message>, subscriber: ConnectedComponent) {
        console.groupCollapsed(); console.log("Adding connection", token);
        console.log('subject:', subject); console.log('subscriber:', subscriber); 
        ConnectionService.connections[token] = {subject: subject, subscriber: subscriber};
        subscriber.setToken(token);
        console.log("Known connections:", ConnectionService.connections);
        console.groupEnd();
    }

    // Remove a connection when a component is done with it.
    removeConnection(componentId: string): void {
        const connection = ConnectionService.connections[componentId].subject;
        if (connection) {
            connection.complete();
            delete ConnectionService.connections[componentId];
        }
    }
    
}