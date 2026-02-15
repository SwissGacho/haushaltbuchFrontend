// console.log('init messages.data');

import { MessageType, Message, IncomingMessage, OutgoingMessage } from "../messages/Message";

export class FetchMessage extends OutgoingMessage {
  object: string;
  index: number | string;

    constructor(
      object: string,
      index: number | string,
      token?: string,
      message_type?: MessageType
    ) {
        super(message_type || MessageType.Fetch, token);
        this.object = object;
        this.index = index;
    }
}

export class ObjectMessage extends IncomingMessage {
  object: string;
  index: number | string;
  payload: any;

  constructor(data: Message) {
    super(data);
    this.object = data.object || '';
    this.index = data.index || '';
    this.payload = data.payload;
  }
}

export class NavigationHeaders extends IncomingMessage {
  headers: string[];

  constructor(data: Message) {
    super(data);
    this.headers = data.payload?.headers || [];
  }
}

export class StoreMessage extends OutgoingMessage {
  object: string;
  index: number | string | null;
  payload: any;

    constructor(
      object: string,
      index: number | string | null,
      payload: any,
      token?: string,
      message_type?: MessageType
    ) {
        super(message_type || MessageType.Store, token);
        this.object = object;
        this.index = index;
        this.payload = payload;
    }
}

export class FetchNavigationHeaders extends FetchMessage {
  constructor(token?: string) {
    super('list', '', token, MessageType.FetchNavigationHeaders);
  }
}

export class FetchList extends FetchMessage {
  constructor(objectType: string, parent?: string, token?: string) {
    super(objectType, parent || '', token, MessageType.FetchList);
  }
}

export class ObjectList extends IncomingMessage {
  objects: string[];

  constructor(data: Message) {
    super(data);
    console.log('ObjectList', data);
    this.objects = data.payload?.objects || [];
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