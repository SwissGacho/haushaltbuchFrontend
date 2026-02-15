// console.log('init messages.data');

import { MessageType, Message, IncomingMessage, OutgoingMessage, ObjectMessageType, NavigationHeadersType, ObjectListType, FetchMessageType, StoreMessageType, FetchLikeType, StoreLikeType, ObjectLikeType } from "../messages/Message";

export class FetchMessage extends OutgoingMessage implements FetchMessageType {
  override type: FetchLikeType = MessageType.Fetch as const;
  object: string;
  index: number | string;

    constructor(
      object: string,
      index: number | string,
      token?: string
    ) {
        super(token);
        this.object = object;
        this.index = index;
    }
}

export class ObjectMessage extends IncomingMessage implements ObjectMessageType {
  override type: ObjectLikeType = MessageType.Object as const;
  object: string;
  index: number | string | null;
  payload?: any;

  constructor(data: Message) {
    super(data);
    this.object = ('object' in data && data.object) ? data.object : '';
    this.index = ('index' in data) ? data.index ?? null : null;
    this.payload = ('payload' in data) ? data.payload : undefined;
  }
}

export class NavigationHeaders extends IncomingMessage implements NavigationHeadersType {
  override type = MessageType.NavigationHeaders as const;
  headers: string[];

  constructor(data: Message) {
    super(data);
    this.headers = ('payload' in data && data.payload?.headers) ? data.payload.headers : [];
  }
}

export class StoreMessage extends OutgoingMessage implements StoreMessageType {
  override type: StoreLikeType = MessageType.Store as const;
  object: string;
  index: number | string | null;
  payload?: any;

    constructor(
      object: string,
      index: number | string | null,
      payload: any,
      token?: string
    ) {
        super(token);
        this.object = object;
        this.index = index;
        this.payload = payload;
    }
}

export class FetchNavigationHeaders extends FetchMessage {
  override type = MessageType.FetchNavigationHeaders as const;

  constructor(token?: string) {
    super('list', '', token);
  }
}

export class FetchList extends FetchMessage {
  override type = MessageType.FetchList as const;

  constructor(objectType: string, parent?: string, token?: string) {
    super(objectType, parent || '', token);
  }
}

export class ObjectList extends IncomingMessage implements ObjectListType {
  override type = MessageType.ObjectList as const;
  objects: string[];

  constructor(data: Message) {
    super(data);
    console.log('ObjectList', data);
    this.objects = ('payload' in data && data.payload?.objects) ? data.payload.objects : [];
  }
}

export class FetchSchemaMessage extends FetchMessage {
  constructor(objectType: string, token?: string) {
    super(objectType, '', token, MessageType.FetchSchema);
  }
}

export class ObjectSchemaMessage extends IncomingMessage {
  schema: any;
  object: string;


  constructor(data: Message) {
    super(data);
    console.log('ObjectSchemaMessage', data);
    this.schema = data.payload || {};
    this.object = data.object || '';
  }
}