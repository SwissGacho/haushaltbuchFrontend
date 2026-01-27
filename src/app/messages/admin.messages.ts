// console.log('init messages.admin');

import { MessageType, Message, IncomingMessage, OutgoingMessage, HelloMessageType, WelcomeMessageType, ByeMessageType, LogMessageType, LoginMessageType, EchoMessageType } from "../messages/Message";

export class HelloMessage extends IncomingMessage implements HelloMessageType {
  override type = MessageType.Hello as const;
}

export class WelcomeMessage extends IncomingMessage implements WelcomeMessageType {
  override type = MessageType.Welcome as const;
  ses_token?: string;
  version_info?: { version?: string };
  
  constructor(data: Message) {
    super(data);
    if ('version_info' in data && data.version_info) {
      this.version_info = data.version_info;
    }
    if ('ses_token' in data && data.ses_token) {
      this.ses_token = data.ses_token;
    }
  }
}

export class ByeMessage extends IncomingMessage implements ByeMessageType {
  override type = MessageType.Bye as const;
  reason?: string;
  
  constructor(data: Message) {
    super(data);
    if ('reason' in data && data.reason) {
      this.reason = data.reason;
    }
  }
}

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warning = "warning",
  Error = "error",
  Critical = "critical"
}

export class LogMessage extends OutgoingMessage implements LogMessageType {
  override type = MessageType.Log as const;
  log_level: LogLevel;
  message: string;
  caller?: string;
  
  constructor(level: LogLevel, msg: string, caller?: string, token?: string) {
    super(MessageType.Log, token);
    this.log_level = level;
    this.message = msg;
    if (caller) { this.caller = caller; }
  }
}

export type LoginCredentials = { user?: string; ses_token?: string; };
export class LoginMessage extends OutgoingMessage implements LoginMessageType {
  override type = MessageType.Login as const;
  user?: string;
  ses_token?: string;
  prev_token?: string;
  is_primary?: boolean;
  component?: string;

  constructor(
    credentials: LoginCredentials,
    token: string,
    isPrimary: boolean = false,
    component?: string,
    status?: string
  ) {
    super(MessageType.Login, token, status);
    const { user, ses_token } = credentials;
    if (user) { this.user = user; }
    if (ses_token) { this.ses_token = ses_token; }
    this.is_primary = isPrimary;
    if (component) { this.component = component; }
  }
}

export class EchoMessage extends OutgoingMessage implements EchoMessageType {
  override type = MessageType.Echo as const;
  component?: string;
  payload?: string;

  constructor(component: string, payload: string) {
    super(MessageType.Echo);
    this.component = component;
    this.payload = payload;
  }
}