import { WelcomeMessage, ByeMessage } from "./admin.messages";
import { HelloMessage } from "./admin.messages";

export enum MessageType {
  None = 'None',
  Log = "Log",
    Hello = "Hello",
    Login = "Login",
    Welcome = "Welcome",
    Setup = "Setup",
    Bye = "Bye",
    Echo = "Echo"
  }

  
export interface Message {
  type: MessageType;
  token?: string;
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

export class OutgoingMessage implements Message {
  type: MessageType;
  token?: string;
  status?: string;
  constructor(type: MessageType, token?: string, status?: string) {
    this.type = type;
    this.token = token;
    if (status) { this.status = status; }
  }
}


