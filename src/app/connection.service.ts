// console.log('init connection service');

import { Injectable, EventEmitter } from '@angular/core';
import * as rxjs from 'rxjs';
import * as rxws from 'rxjs/webSocket';
import { environment } from '../environments/environment';
import {
    HelloMessage,
    WelcomeMessage,
    ByeMessage,
    LogMessage,
    LogLevel,
    LoginMessage,
    LoginCredentials,
} from './messages/admin.messages';
import { Message, IncomingBaseMessage } from './messages/Message';
import { MessageFactory } from './messages/deserialize_message';

export interface ConnectionSubscriber {
    componentID: string;
    setToken(to: string): void;
    sendMessage(message: Message): void;
    handleMessages(message: IncomingBaseMessage): void;
    handleError(error: any): void;
    handleComplete(): void;
}

export class RXJS {
    static take(n: number): rxjs.MonoTypeOperatorFunction<any> {
        return rxjs.take(n);
    }
    static skip(n: number): rxjs.MonoTypeOperatorFunction<any> {
        return rxjs.skip(n);
    }
}

export class Logger {
    private static readonly interceptedMethods = [
        // 'debug',
        'log',
        'info',
        'warn',
        'error',
    ];
    private static originalConsoleMethods: {
        [method: string]: ((...args: any[]) => void) | undefined;
    } = {};

    static takeOverConsole(component: ConnectionSubscriber) {
        const consoleObj: any = window.console;
        if (!consoleObj) return;

        // Ensure reconnects do not create nested wrappers.
        Logger.restoreConsole();

        function intercept(method: string, level: LogLevel) {
            if (!Logger.originalConsoleMethods[method]) {
                Logger.originalConsoleMethods[method] = consoleObj[method];
            }
            const original = Logger.originalConsoleMethods[method];
            consoleObj[method] = function (...args: any[]) {
                // join arguments to one string
                const message = args.join(' ');
                // determine caller of console message
                let caller = '';
                let lineNumber: number | undefined;
                const stack = new Error().stack;
                if (stack) {
                    const stackLine = stack.split('\n')[2]?.trim() ?? '';
                    caller = stackLine.split(' ')[1] ?? '';
                    const lineMatch = stackLine.match(/:(\d+):\d+\)?$/);
                    if (lineMatch) {
                        lineNumber = Number(lineMatch[1]);
                    }
                }
                const logMessage = new LogMessage(level, message, caller);
                if (lineNumber !== undefined) {
                    logMessage.line_number = lineNumber;
                }
                component.sendMessage(logMessage);
                // output to console
                if (typeof original === 'function') {
                    original.apply(consoleObj, args);
                }
            };
        }

        const methods = Logger.interceptedMethods;
        const levels = [
            // LogLevel.Debug,
            LogLevel.Log,
            LogLevel.Info,
            LogLevel.Warning,
            LogLevel.Error,
        ];
        for (let i = 0; i < methods.length; i++) {
            intercept(methods[i], levels[i]);
        }
    }

    static restoreConsole() {
        const consoleObj: any = window.console;
        if (!consoleObj) return;

        for (const method of Logger.interceptedMethods) {
            const original = Logger.originalConsoleMethods[method];
            if (typeof original === 'function') {
                consoleObj[method] = original;
            }
        }
    }
}

type LoginSubject = rxjs.Subject<{ user?: string; ses_token?: string }>;

@Injectable({ providedIn: 'root' })
/// This Service manages all WebSocket connections to the backend.
/// It provides new connections to components that need them, and manages the connections.
/// Components should call the getNewConnection method to get a new connection.
/// They should also call the removeConnection method when they are done with the connection.
export class ConnectionService {
    constructor() {}

    // Development uses local websocket backend. For production derive the
    // websocket URL from the URL the frontend was served from so the
    // Nginx reverse proxy (https) is used automatically.
    BACKEND_ADDRESS = environment.production
        ? ((): string => {
              const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
              // Production websocket path served behind the Nginx reverse proxy
              return `${wsProtocol}//${window.location.host}/ws/`;
          })()
        : 'ws://localhost:8765/';

    static connections: {
        [componentId: string]: {
            subject: rxws.WebSocketSubject<Message>;
            subscriber: ConnectionSubscriber;
        };
    } = {};

    static loginBySessionTokenSubject = new rxjs.ReplaySubject<LoginCredentials>();
    static _sessionToken: string = '';

    // methods acting as wrappers for imported functions, allowing replacement by unittest spies
    webSocket(cfg: rxws.WebSocketSubjectConfig<Message>): rxws.WebSocketSubject<Message> {
        return rxws.webSocket(cfg);
    }

    loginCompLoginSubject?: rxjs.Subject<LoginCredentials>;

    // Create a new connection and subscribe for the handshake messages (HelloMessage, WelcomeMessage).
    // Subscribe the subscriber for further messages.
    // The optional second parameter provides either a Subject or a boolean
    // If a Subject is present it will be subscribed for the login credentials, otherwise an internal observer
    // will be used for accessing the session token as login credential
    // If the secon parameter is truthy the handshake messages (first 2 messages) will be delivered to the subscriber
    getNewConnection(
        subscriber: ConnectionSubscriber,
        loginSubject?: rxjs.Subject<LoginCredentials>,
        isPrimary?: boolean
    ): void;
    getNewConnection(
        subscriber: ConnectionSubscriber,
        observeHandshake?: boolean,
        isPrimary?: boolean
    ): void;
    getNewConnection(
        subscriber: ConnectionSubscriber,
        loginSubjectOrObserveHandshake?: rxjs.Subject<LoginCredentials> | boolean,
        isPrimary?: boolean
    ): void;
    getNewConnection(
        subscriber: ConnectionSubscriber,
        loginSubjectOrObserveHandshake?: rxjs.Subject<LoginCredentials> | boolean,
        isPrimary?: boolean
    ): void {
        console.groupCollapsed('Creating connection for component ', subscriber.componentID);
        console.debug('Subscriber: ', subscriber);
        console.debug('LoginSubjectOrObserveHandshake: ', loginSubjectOrObserveHandshake);
        console.debug('is primary: ', isPrimary);
        console.debug('Backend address: ', this.BACKEND_ADDRESS);
        let connection = this.webSocket({
            url: this.BACKEND_ADDRESS,
            deserializer: (event) => MessageFactory.deserialize(event) as Message,
        });
        let loginSubject: LoginSubject;
        loginSubject =
            loginSubjectOrObserveHandshake instanceof rxjs.Subject
                ? loginSubjectOrObserveHandshake
                : ConnectionService.loginBySessionTokenSubject;
        ConnectionService.addConnection(connection, subscriber);
        connection.pipe(RXJS.skip(loginSubjectOrObserveHandshake ? 0 : 2)).subscribe({
            next: (message: Message) => subscriber.handleMessages(message as IncomingBaseMessage),
            complete: () => subscriber.handleComplete(),
            error: (error: any) => subscriber.handleError(error),
        });
        connection.pipe(RXJS.take(2)).subscribe({
            next: (message: Message) =>
                this.handleHandshakeMessages(message, {
                    service: this,
                    connection: connection,
                    subscriber: subscriber,
                    /* use either credentials from the subscriber or the local session token: */
                    loginSubject: loginSubject,
                    isPrimary: isPrimary == true,
                    // ,rxjsTake: RXJS.takeCred
                }),
            // ,complete: () => { console.log('handshake completed for', subscriber.componentID); }
        });
        console.groupEnd();
    }

    // Handle the first two messages from a new connection, it should be a HelloMessage and a WelcomeMessage
    // If the session token is not set yet, assume we receive it after successfull logon by
    // LoginComponent and send the ses_token through the sessionTokenSubject
    handleHandshakeMessages(
        message: Message,
        that?: {
            service: ConnectionService;
            connection: rxws.WebSocketSubject<Message>;
            subscriber: ConnectionSubscriber;
            loginSubject: LoginSubject;
            isPrimary: boolean;
            // ,rxjsTake: (n: number) => rxjs.MonoTypeOperatorFunction<LoginCredentials>
        }
    ) {
        console.groupCollapsed(
            'handle handshake: ',
            message.type,
            'to',
            that?.subscriber.componentID
        );
        console.debug(message);
        console.debug('that:', that);
        console.groupEnd();
        if (message instanceof HelloMessage) {
            if (that && message.token) {
                console.debug(that.subscriber.componentID, 'awaits credentials');
                that.subscriber.setToken(message.token);
                if (that.isPrimary) {
                    Logger.takeOverConsole(that.subscriber);
                }
                that.loginSubject.pipe(RXJS.take(1)).subscribe({
                    next: (credentials: LoginCredentials) => {
                        console.debug(that.subscriber.componentID, 'got credentials:', credentials);
                        that.service.sendMessage(
                            new LoginMessage(
                                credentials,
                                message.token!,
                                that.isPrimary,
                                that.subscriber.componentID
                            ),
                            that.subscriber.componentID
                        );
                    },
                });
                // no need to unsubscribe because take(1) implicates that
            }
        } else if (message instanceof WelcomeMessage) {
            // if received session token is from different session this is an error
            if (
                message.ses_token &&
                ConnectionService._sessionToken &&
                message.ses_token != ConnectionService._sessionToken
            ) {
                console.error('Received session token of alien session');
                throw new Error('Received session token of alien session');
            }
            // if the session token is not set yet provide it for other connections
            if (message.ses_token && !ConnectionService._sessionToken) {
                ConnectionService._sessionToken = message.ses_token;
                sessionStorage.setItem('SessionToken', message.ses_token);
                ConnectionService.loginBySessionTokenSubject.next({ ses_token: message.ses_token });
            }
            if (that) {
                console.log('Connection established for', that.subscriber.componentID);
            }
        } else if (message instanceof ByeMessage) {
            console.error('Logon failed (', message.reason, ') for', that?.subscriber.componentID);
            if (message.reason == 'Session expired') {
                console.warn(
                    'Session expired, clearing session token, closing all connections and reloading page'
                );
                ConnectionService._sessionToken = '';
                sessionStorage.removeItem('SessionToken');
                this.closeAllConnections();
                // Reload the page
                location.reload();
            }
        }
    }

    // Send a message to the backend.
    sendMessage(message: Message, componentId: string) {
        const connectionData = ConnectionService.connections[componentId];
        if (!connectionData || !connectionData.subject) {
            return;
        }
        const connection = connectionData.subject;
        if (!(message instanceof LogMessage)) {
            console.groupCollapsed('Sending', message.type, 'for', componentId);
            console.debug('Message:', message);
            console.debug('Connection:', connection);
            console.debug('Component:', connectionData.subscriber);
            console.groupEnd();
        }
        connection.next(message);
    }

    // Associate a connection token to the WS connection und the subscribing component
    static addConnection(
        subject: rxws.WebSocketSubject<Message>,
        subscriber: ConnectionSubscriber
    ) {
        console.groupCollapsed('Adding connection', subscriber.componentID);
        console.debug('subject:', subject);
        console.debug('subscriber:', subscriber);
        ConnectionService.connections[subscriber.componentID] = {
            subject: subject,
            subscriber: subscriber,
        };
        console.debug('Known connections:', ConnectionService.connections);
        console.groupEnd();
    }

    // Remove a connection when a component is done with it.
    removeConnection(componentId: string): void {
        if (!ConnectionService.connections[componentId]) {
            console.error('Closing connection not found.');
            return;
        }
        ConnectionService.connections[componentId].subject.complete();
        // according to ChatGPT we don't need to unsubscribe after .complete()
        // evreything is already closed cleanly
        delete ConnectionService.connections[componentId];
    }

    // Close all known websocket connections and reset session-related service state.
    closeAllConnections(): void {
        Logger.restoreConsole();
        Object.keys(ConnectionService.connections).forEach((componentId: string) => {
            // try {
            //     ConnectionService.connections[componentId].subject.complete();
            // } catch (error) {
            //     console.error('Failed to close connection for', componentId, error);
            // }
            this.removeConnection(componentId);
        });
        // ConnectionService.connections = {};
        ConnectionService.loginBySessionTokenSubject = new rxjs.ReplaySubject<LoginCredentials>();
        const storedToken = sessionStorage.getItem('SessionToken');
        ConnectionService._sessionToken = storedToken ?? '';
        if (storedToken) {
            ConnectionService.loginBySessionTokenSubject.next({ ses_token: storedToken });
        }
    }
}
