// console.log('init messages.data');

import { FetchMessage, ObjectMessage, StoreMessage } from "../messages/data.messages";
import { Message, MessageType } from "../messages/Message"

export class FetchSetupMessage extends FetchMessage {
  override type = MessageType.FetchSetup as const;

    constructor(object: string, index: number | string, token?: string) {
        super(object, index, token);
    }
}

export class ObjectSetupMessage extends ObjectMessage {
  override type = MessageType.ObjectSetup as const;

  constructor(data: Message) { 
    super(data);
  }
}

export class StoreSetupMessage extends StoreMessage {
  override type = MessageType.StoreSetup as const;

    constructor(object: string, index: number | string, payload: any, token?: string) {
        super(object, index, payload, token);
    }
}