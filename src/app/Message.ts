export enum MessageType {
    Hello = "Hello",
    Login = "Login",
    Welcome = "Welcome",
    Bye = "Bye"
  }

  
export interface Message {
  type: MessageType;
  token: string;
  status?: string;
  reason?: string;
  ses_token?: string;
}


export class IncomingMessage implements Message {
    type: MessageType;
    token: string;
    status?: string;
    ses_token?: string;
    constructor(data: Message) {
      this.type = data.type;
      this.token = data.token || '';
      this.status = data.status;
      this.ses_token = data.ses_token;
    }
    static deserialize(event: MessageEvent): Message {
      let data = JSON.parse(event.data)
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
}

export class HelloMessage extends IncomingMessage {
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

export class OutgoingMessage implements Message {
  type: MessageType;
  token: string;
  status?: string;
  constructor(type: MessageType, token: string, status?: string) {
    this.type = type;
    this.token = token;
    if (status) { this.status = status; }
  }
}

export type LoginCredentials = {user?: string, ses_token?: string};
export class LoginMessage extends OutgoingMessage {
    user?: string;
    ses_token?: string;
    prev_token?: string;
    is_primary?: boolean;
    constructor(credentials: LoginCredentials, token: string, isPrimary: boolean = false, status?: string) {
      super(MessageType.Login, token, status);
      const {user, ses_token} = credentials;
      if (user) { this.user = user; }
      if (ses_token) { this.ses_token = ses_token; }
      this.is_primary = isPrimary;
    }
  }
