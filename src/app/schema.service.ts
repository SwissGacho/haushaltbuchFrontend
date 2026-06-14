import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, throwError } from 'rxjs';
import { ObjectSchema } from './business-object/bo-schema/bo.schema.types';
import { parseObjectSchema } from './business-object/bo-schema/bo.schema.parse';
import { ConnectionService, ConnectionSubscriber } from './connection.service';
import { IncomingBaseMessage, Message, MessageType } from './messages/Message';
import { FetchSchemaMessage, ObjectSchemaMessage } from './messages/data.messages';
import { WelcomeMessage, ByeMessage, HelloMessage } from './messages/admin.messages';
import { IdentifiedComponent } from './identified.component';

class SchemaConnectionClient extends IdentifiedComponent implements ConnectionSubscriber {
    constructor(
        protected connectionService: ConnectionService,
        private readonly schemaService: SchemaService
    ) {
        super();
        this.setComponentID('SchemaService');
    }

    OBSERVE_HANDSHAKE = true;

    connected = false;
    protected token: string | null = null;

    setToken(to: string): void {
        this.token = to;
    }

    sendMessage(message: Message) {
        // console.log("Connected Component prepares to send message:", message);
        if (this.token == null) {
            console.warn('Tried to send a message before the connection token was set', message);
            return;
        }
        message.token = this.token;
        this.connectionService.sendMessage(message, this.componentID);
    }

    handleMessages(message: IncomingBaseMessage): void {
        if (message instanceof HelloMessage) {
            return;
        }

        if (message instanceof WelcomeMessage) {
            // Connection fully authenticated, now safe to flush queued requests
            this.schemaService.onConnectionReady();
            return;
        }

        if (message instanceof ByeMessage) {
            console.error('SchemaService connection login failed');
            return;
        }

        if (message.type === MessageType.ObjectSchema) {
            this.schemaService.handleSchemaMessage(message as ObjectSchemaMessage);
            return;
        }

        console.warn('SchemaService received unexpected message type', message.type, message);
    }

    handleError(error: unknown): void {
        this.schemaService.handleConnectionError(error);
        this.connectionService.removeConnection(this.componentID);
        this.connected = false;
    }

    handleComplete(): void {
        this.connected = false;
        this.schemaService.onConnectionClosed();
        console.warn(`Connection closed for component ${this.componentID}.`);
    }

    connect(): void {
        this.connectionService.getNewConnection(this, this.OBSERVE_HANDSHAKE);
        this.connected = true;
    }

    requestSchema(objectType: string): boolean {
        if (this.token === null) {
            return false;
        }

        this.sendMessage(new FetchSchemaMessage(objectType, this.token));
        return true;
    }
}

type SchemaRequestState = 'queued' | 'inFlight' | 'resolved' | 'failed' | 'timedOut';

class SchemaRequest {
    readonly stream = new ReplaySubject<ObjectSchema>(1);
    state: SchemaRequestState = 'queued';
    attempts = 0;
    readonly createdAt = Date.now();
    lastSentAt: number | null = null;
    lastError: unknown = null;

    constructor(readonly objectType: string) {}

    canSend(): boolean {
        return this.state === 'queued';
    }

    isTerminal(): boolean {
        return this.state === 'resolved' || this.state === 'failed' || this.state === 'timedOut';
    }

    markInFlight(): void {
        this.state = 'inFlight';
        this.attempts += 1;
        this.lastSentAt = Date.now();
    }

    markQueued(): void {
        if (this.isTerminal()) {
            return;
        }
        this.state = 'queued';
    }

    resolve(schema: ObjectSchema): void {
        if (this.isTerminal()) {
            return;
        }

        this.stream.next(schema);
        this.stream.complete();
        this.state = 'resolved';
    }

    fail(error: unknown): void {
        if (this.isTerminal()) {
            return;
        }

        this.lastError = error;
        this.stream.error(error);
        this.state = 'failed';
    }

    timeout(error: unknown = new Error('Schema request timed out')): void {
        if (this.isTerminal()) {
            return;
        }

        this.lastError = error;
        this.stream.error(error);
        this.state = 'timedOut';
    }

    applySchemaResponse(
        schemaPayload: unknown,
        parseSchema: (payload: unknown) => ObjectSchema
    ): { ok: true } | { ok: false; error: unknown } {
        if (this.isTerminal()) {
            return { ok: true };
        }

        try {
            const parsedSchema = parseSchema(schemaPayload);
            this.resolve(parsedSchema);
            return { ok: true };
        } catch (error) {
            this.fail(error);
            return { ok: false, error };
        }
    }

    asObservable(): Observable<ObjectSchema> {
        return this.stream.asObservable();
    }
}

@Injectable({
    providedIn: 'root',
})
export class SchemaService {
    private readonly requests = new Map<string, SchemaRequest>();
    private client: SchemaConnectionClient | null = null;
    private connectionReady = false;

    constructor(private readonly connectionService: ConnectionService) {}

    getSchema(objectType: string): Observable<ObjectSchema> {
        const normalizedType = objectType.trim();
        if (normalizedType.length === 0) {
            return throwError(() => new Error('objectType must not be empty'));
        }

        const existingRequest = this.requests.get(normalizedType);
        if (existingRequest) {
            return existingRequest.asObservable();
        }

        const request = new SchemaRequest(normalizedType);
        this.requests.set(normalizedType, request);

        this.ensureConnection();
        this.tryFlushQueuedRequests();

        return request.asObservable();
    }

    onConnectionReady(): void {
        this.connectionReady = true;
        this.tryFlushQueuedRequests();
    }

    onConnectionClosed(): void {
        this.connectionReady = false;
        this.client = null;

        // Keep unresolved requests queued so they can be sent again on reconnect.
        for (const request of this.requests.values()) {
            if (!request.isTerminal()) {
                request.markQueued();
            }
        }
    }

    handleSchemaMessage(message: ObjectSchemaMessage): void {
        if (!message.object) {
            console.warn('SchemaService received schema without object type', message);
            return;
        }

        const objectType = message.object;

        const request = this.requests.get(objectType);
        if (request) {
            const result = request.applySchemaResponse(message.schema, parseObjectSchema);
            if (!result.ok) {
                console.warn('Failed to parse schema for object type', objectType, result.error);
                this.requests.delete(objectType);
            }
        } else {
            console.warn(
                'Received schema for object type with no active request',
                objectType,
                message
            );
        }
    }

    handleConnectionError(error: unknown): void {
        for (const [objectType, request] of this.requests.entries()) {
            if (request.state === 'resolved') {
                continue;
            }

            request.fail(error);
            this.requests.delete(objectType);
        }

        this.client = null;
        this.connectionReady = false;
    }

    private ensureConnection(): void {
        if (this.client) {
            return;
        }

        this.client = new SchemaConnectionClient(this.connectionService, this);
        this.client.connect();
    }

    private tryFlushQueuedRequests(): void {
        if (!this.client || !this.connectionReady) {
            return;
        }

        for (const request of this.requests.values()) {
            if (!request.canSend()) {
                continue;
            }

            const sent = this.client.requestSchema(request.objectType);
            if (sent) {
                request.markInFlight();
            }
        }
    }
}
