import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, of, throwError } from 'rxjs';
import { ObjectSchema } from './business-object/bo-schema/bo.schema.types';
import { parseObjectSchema } from './business-object/bo-schema/bo.schema.parse';
import { ConnectionService } from './connection.service';
import { IncomingBaseMessage, Message, MessageType } from './messages/Message';
import {
    FetchSchemaMessage,
    ObjectSchemaMessage,
} from './messages/data.messages';
import { WelcomeMessage, ByeMessage } from './messages/admin.messages';
import { BaseComponent } from './base.component';

class SchemaConnectionClient extends BaseComponent {
    constructor(
        protected connectionService: ConnectionService,
        private readonly schemaService: SchemaService,
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
            console.warn(
                'Tried to send a message before the connection token was set',
                message,
            );
            return;
        }
        message.token = this.token;
        this.connectionService.sendMessage(message, this.componentID);
    }

    handleMessages(message: IncomingBaseMessage): void {
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
            this.schemaService.handleSchemaMessage(
                message as ObjectSchemaMessage,
            );
            return;
        }

        console.warn(
            'SchemaService received unexpected message type',
            message.type,
            message,
        );
    }

    handleError(error: unknown): void {
        this.schemaService.handleConnectionError(error);
    }

    handleComplete(): void {
        this.connected = false;
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

@Injectable({
    providedIn: 'root',
})
export class SchemaService {
    private readonly schemaCache = new Map<
        string,
        ReplaySubject<ObjectSchema>
    >();
    private readonly queuedTypes = new Set<string>();
    private client: SchemaConnectionClient | null = null;

    constructor(private readonly connectionService: ConnectionService) {}

    getSchema(objectType: string): Observable<ObjectSchema> {
        const normalizedType = objectType.trim();
        if (normalizedType.length === 0) {
            return throwError(() => new Error('objectType must not be empty'));
        }

        const cachedSchema = this.schemaCache.get(normalizedType);
        if (cachedSchema) {
            return cachedSchema.asObservable();
        }

        const subject = new ReplaySubject<ObjectSchema>(1);
        this.schemaCache.set(normalizedType, subject);
        this.queuedTypes.add(normalizedType);

        this.ensureConnection();

        return subject.asObservable();
    }

    onConnectionReady(): void {
        this.flushQueuedRequests();
    }

    handleSchemaMessage(message: ObjectSchemaMessage): void {
        if (!message.object) {
            console.warn(
                'SchemaService received schema without object type',
                message,
            );
            return;
        }

        const objectType = message.object;
        let parsedSchema: ObjectSchema;

        try {
            parsedSchema = parseObjectSchema(message.schema);
        } catch (error) {
            this.failPending(objectType, error);
            return;
        }

        const schemaStream = this.schemaCache.get(objectType);
        if (schemaStream) {
            schemaStream.next(parsedSchema);
            schemaStream.complete();
        }
    }

    handleConnectionError(error: unknown): void {
        for (const [objectType, subject] of this.schemaCache.entries()) {
            subject.error(error);
            this.schemaCache.delete(objectType);
        }

        this.queuedTypes.clear();
    }

    private failPending(objectType: string, error: unknown): void {
        const pending = this.schemaCache.get(objectType);
        if (!pending) {
            return;
        }

        pending.error(error);
        this.schemaCache.delete(objectType);
        this.queuedTypes.delete(objectType);
    }

    private ensureConnection(): void {
        if (this.client) {
            return;
        }

        this.client = new SchemaConnectionClient(this.connectionService, this);
        this.client.connect();
    }

    private flushQueuedRequests(): void {
        if (!this.client) {
            return;
        }

        for (const objectType of Array.from(this.queuedTypes)) {
            const sent = this.client.requestSchema(objectType);
            if (sent) {
                this.queuedTypes.delete(objectType);
            }
        }
    }
}
