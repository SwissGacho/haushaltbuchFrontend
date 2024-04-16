import { Injectable, EventEmitter } from '@angular/core';
// import { Observable, ReplaySubject, Subject, skip, take } from 'rxjs';
import * as rxjs from 'rxjs';
// import { webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import * as rxws from 'rxjs/webSocket';
import { HelloMessage, LoginMessage, Message, IncomingMessage, MessageType, WelcomeMessage, ByeMessage, LoginCredentials } from './Message';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';

type LoginSubject = rxjs.Subject<{user?: string, ses_token?: string}>;

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
        subject: rxws.WebSocketSubject<Message>,
        subscriber: ConnectedComponent
    } } = {};

    static loginBySessionTokenSubject = new rxjs.ReplaySubject<LoginCredentials>();
    private static _sessionToken: string = "";

    // methods acting as wrappers for imported functions, allowing replacement by unittest spies
    webSocket(cfg: rxws.WebSocketSubjectConfig<Message>): rxws.WebSocketSubject<Message> {
        return rxws.webSocket(cfg);
    }
    rxjsTake(n: number): rxjs.MonoTypeOperatorFunction<Message> { return rxjs.take(n); }
    rxjsSkip(n: number): rxjs.MonoTypeOperatorFunction<Message> { return rxjs.skip(n); }

    componentCounter: number = 0;

    // Create a new connection and subscribe for the handshake messages (HelloMessage, WelcomeMessage).
    // Subscribe the subscriber for further messages.
    // The optional second parameter provides either a Subject or a boolean 
    // If a Subject is present it will be subscribed for the login credentials, otherwise an internal observer
    // will be used for accessing the session token as login credential
    // If the secon parameter is truthy the handshake messages (first 2 messages) will be delivered to the subscriber
    getNewConnection(subscriber: ConnectedComponent, loginSubject?: rxjs.Subject<LoginCredentials>, isPrimary?: boolean): void;
    getNewConnection(subscriber: ConnectedComponent, observeHandshake?: boolean, isPrimary?: boolean): void;
    getNewConnection(
        subscriber: ConnectedComponent,
        loginSubjectOrObserveHandshake?: rxjs.Subject<LoginCredentials> | boolean,
        isPrimary?: boolean
    ): void {
        let comp_num = ++this.componentCounter;
        console.groupCollapsed('Creating connection for component ', subscriber.componentID, '; comp#: ', comp_num);
        console.log('Subscriber: ', subscriber); 
        console.log('LoginSubjectOrObserveHandshake: ',loginSubjectOrObserveHandshake);
        console.log('is primary: ', isPrimary);
        let connection = this.webSocket({url: this.BACKEND_ADDRESS, deserializer: IncomingMessage.deserialize});
        let loginSubject: LoginSubject;
        loginSubject = (loginSubjectOrObserveHandshake instanceof rxjs.Subject)
            ? loginSubjectOrObserveHandshake
            : ConnectionService.loginBySessionTokenSubject;
        connection.pipe(this.rxjsTake(2)).subscribe({
            next: (message: Message) => this.handleHandshakeMessages(
                message, {
                    component_num: comp_num,
                    service: this,
                    connection: connection,
                    subscriber: subscriber,
                    /* use either credentials from the subscriber or the local session token: */
                    loginSubject: loginSubject,
                    isPrimary: isPrimary == true
                }
            )
        });
        console.log('skip:', loginSubjectOrObserveHandshake ? 0 : 2);
        connection.pipe(this.rxjsSkip(loginSubjectOrObserveHandshake ? 0 : 2)).subscribe({
            next: (message: Message) => subscriber.handleMessages(message),
            complete: () => subscriber.handleComplete(),
            error: (error: any) => subscriber.handleError(error)
        });
        console.groupEnd();
    }
    
    // Handle the first two messages from a new connection, it should be a HelloMessage and a WelcomeMessage
    // If the session token is not set yet, assume we receive it after successfull logon by 
    // LoginComponent and send the ses_token through the sessionTokenSubject
    handleHandshakeMessages(
        message: Message,
        that?: {
            component_num: number,
            service: ConnectionService,
            connection: rxws.WebSocketSubject<Message>,
            subscriber: ConnectedComponent,
            loginSubject: LoginSubject,
            isPrimary: boolean
        }
    ) {
        console.groupCollapsed('handle handshake: ', message.type, '; comp#: ', that?.component_num);
        console.log( message); console.log('that:', that);
        console.groupEnd();
        if (message instanceof HelloMessage) {
            if (that) {
                console.log('attach token ', message.token, ' to component ', that.subscriber.componentID)
                ConnectionService.addConnection(message.token, that.connection, that.subscriber);
                that.loginSubject.pipe(rxjs.take(1)).subscribe(
                    (credentials: LoginCredentials) => {
                        console.log('Got credentials: ', credentials);
                        that.service.sendMessage(new LoginMessage(credentials, message.token, that.isPrimary));
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
    static addConnection(token: string, subject: rxws.WebSocketSubject<Message>, subscriber: ConnectedComponent) {
        console.groupCollapsed("Adding connection", token);
        console.log('subject:', subject); console.log('subscriber:', subscriber); 
        ConnectionService.connections[token] = {subject: subject, subscriber: subscriber};
        subscriber.setToken(token);
        console.log("Known connections:", ConnectionService.connections);
        console.groupEnd();
    }

    // Remove a connection when a component is done with it.
    removeConnection(componentId: string): void {
        console.log('-----------------------------------------------------------------------------------------Connections vor Fehler:', ConnectionService.connections)
        const connection = ConnectionService.connections[componentId].subject;
        if (connection) {
            connection.complete();
            delete ConnectionService.connections[componentId];
        }
    }
    
}