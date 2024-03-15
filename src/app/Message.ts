export enum MessageType {
    Hello = "Hello",
    Login = "Login",
    Welcome = "Welcome",
    Bye = "Bye"
  }

export interface Message {
    type: MessageType;
    token?: string;
    status?: string;
    ses_token?: string;
    reason?: string;
  }

export function deserialize(event: MessageEvent): Message {
    let data = JSON.parse(event.data)
    let message: Message;
    switch (data.type) {
      case MessageType.Hello:
        return new HelloMessage(data);
      case MessageType.Welcome:
        return new WelcomeMessage(data);
      case MessageType.Bye:
        return new ByeMessage(data);
      default:
        return new IncomingMessage(data);
    }
  }

class IncomingMessage implements Message {
    type: MessageType;
    token: string;
    status?: string;
    constructor(data: Message) {
      this.type = data.type;
      this.token = data.token || '';
      this.status = data.status;
    }
}

class OutgoingMessage implements Message {
  type: MessageType;
  token?: string;
  status?: string;
  constructor(type: MessageType, token?: string, status?: string) {
    this.type = type;
    this.token = token;
    this.status = status;
  }
}


export class HelloMessage extends IncomingMessage {
}

export class LoginMessage extends OutgoingMessage {
    user: string;
    constructor(user:string, token?: string, status?: string) {
      super(MessageType.Login, token, status);
      this.user = user;
    }
  }

export class LoginMessageWithSessionToken extends OutgoingMessage {
  ses_token: string;
  constructor(ses_token: string, token?: string, status?: string) {
    super(MessageType.Login, token, status);
    this.ses_token = ses_token;
  }
}

export class WelcomeMessage extends IncomingMessage {
}

export class ByeMessage extends IncomingMessage {
  reason: string;
  constructor(data: Message) {
    super(data);
    this.reason = data.reason || '';
  }
}