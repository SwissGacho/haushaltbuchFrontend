// console.log('init messages.data');

import { MessageType, Message, IncomingMessage, OutgoingMessage, ObjectMessageType, ObjectSetupMessageType, NavigationHeadersType, ObjectListType, FetchMessageType, StoreMessageType } from "../messages/Message";

export class FetchMessage extends OutgoingMessage implements FetchMessageType {
  override type: MessageType.Fetch | MessageType.FetchSetup | MessageType.FetchNavigationHeaders | MessageType.FetchList;
  object: string;
  index: number | string;

    constructor(
      object: string,
      index: number | string,
      token?: string,
      message_type?: MessageType
    ) {
        super(message_type || MessageType.Fetch, token);
        this.type = message_type || MessageType.Fetch;
        this.object = object;
        this.index = index;
    }
}

export class ObjectMessage extends IncomingMessage implements ObjectMessageType {
  override type = MessageType.Object as const;
  object: string;
  index: number | string | null;
  payload?: any;

  constructor(data: Message) {
    super(data);
    this.object = ('object' in data && data.object) ? data.object : '';
    this.index = ('index' in data && data.index) ? data.index : null;
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
  override type: MessageType.Store | MessageType.StoreSetup;
  object: string;
  index: number | string | null;
  payload?: any;

    constructor(
      object: string,
      index: number | string | null,
      payload: any,
      token?: string,
      message_type?: MessageType
    ) {
        super(message_type || MessageType.Store, token);
        this.type = message_type || MessageType.Store;
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

export class ObjectList extends IncomingMessage implements ObjectListType {
  override type = MessageType.ObjectList as const;
  objects: string[];

  constructor(data: Message) {
    super(data);
    console.log('ObjectList', data);
    this.objects = ('payload' in data && data.payload?.objects) ? data.payload.objects : [];
  }
}