// console.log('init messages.Message');

import { HelloMessage, WelcomeMessage, ByeMessage } from "./admin.messages";
import { ObjectMessage } from "./data.messages"

export enum MessageType {
  None = 'None',
  Log = "Log",
  Hello = "Hello",
  Login = "Login",
  Welcome = "Welcome",
  Setup = "Setup",
  Bye = "Bye",
  Echo = "Echo",
  Fetch = "Fetch",
  Object = "Object",
  Store = 'Store',
  FetchSetup = "FetchSetup",
  ObjectSetup = "ObjectSetup",
  StoreSetup = 'StoreSetup',
  FetchNavigationHeaders = 'FetchNavigationHeaders',
  NavigationHeaders = 'NavigationHeaders',
  FetchList = 'FetchList',
  ObjectList = 'ObjectList',
}

// Base interfaces for incoming and outgoing messages
export interface BaseMessage {
  type: MessageType;
}

export interface IncomingBaseMessage extends BaseMessage {
  token?: string;
  status?: string;
}

export interface OutgoingBaseMessage extends BaseMessage {
  token?: string;
  status?: string;
}

// Discriminated union types for incoming messages
export interface HelloMessageType extends IncomingBaseMessage {
  type: MessageType.Hello;
}

export interface WelcomeMessageType extends IncomingBaseMessage {
  type: MessageType.Welcome;
  version_info?: { version?: string; [key: string]: any };
}

export interface ByeMessageType extends IncomingBaseMessage {
  type: MessageType.Bye;
  reason?: string;
}

export interface ObjectMessageType extends IncomingBaseMessage {
  type: MessageType.Object;
  object: string;
  index: number | string | null;
  payload?: any;
}

export interface ObjectSetupMessageType extends IncomingBaseMessage {
  type: MessageType.ObjectSetup;
  object: string;
  index: number | string | null;
  payload?: any;
}

export interface NavigationHeadersType extends IncomingBaseMessage {
  type: MessageType.NavigationHeaders;
  payload?: { headers?: string[] };
}

export interface ObjectListType extends IncomingBaseMessage {
  type: MessageType.ObjectList;
  payload?: { objects?: string[] };
}

// Discriminated union types for outgoing messages
export interface LogMessageType extends OutgoingBaseMessage {
  type: MessageType.Log;
  log_level: string;
  message: string;
  caller?: string;
}

export interface LoginMessageType extends OutgoingBaseMessage {
  type: MessageType.Login;
  user?: string;
  ses_token?: string;
  prev_token?: string;
  is_primary?: boolean;
  component?: string;
}

export interface EchoMessageType extends OutgoingBaseMessage {
  type: MessageType.Echo;
  component?: string;
  payload?: string;
}

export interface FetchMessageType extends OutgoingBaseMessage {
  type: MessageType.Fetch | MessageType.FetchSetup | MessageType.FetchNavigationHeaders | MessageType.FetchList;
  object: string;
  index: number | string;
}

export interface StoreMessageType extends OutgoingBaseMessage {
  type: MessageType.Store | MessageType.StoreSetup;
  object: string;
  index: number | string | null;
  payload?: any;
}

// Combined discriminated union for all message types
export type Message = 
  | HelloMessageType
  | WelcomeMessageType
  | ByeMessageType
  | ObjectMessageType
  | ObjectSetupMessageType
  | NavigationHeadersType
  | ObjectListType
  | LogMessageType
  | LoginMessageType
  | EchoMessageType
  | FetchMessageType
  | StoreMessageType;

// Base classes for runtime usage
export class OutgoingMessage implements OutgoingBaseMessage {
  type: MessageType;
  token?: string;
  status?: string;
  constructor(type: MessageType, token?: string, status?: string) {
    this.type = type;
    this.token = token;
    if (status) { this.status = status; }
  }
}

export class IncomingMessage implements IncomingBaseMessage {
    type: MessageType;
    token?: string;
    status?: string;
    constructor(data: Message) {
      this.type = data.type;
      this.token = data.token;
      this.status = data.status;
    }
}



