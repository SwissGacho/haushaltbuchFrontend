import { MessageType, Message, IncomingMessage, OutgoingMessage } from "../messages/Message";


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

export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warning = "warning",
  Error = "error",
  Critical = "critical"
}
export class LogMessage extends OutgoingMessage {
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
export class LoginMessage extends OutgoingMessage {
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

export enum UserModes { single='single', multi='multi'}
export enum DBs { sqlite= 'SQLite', mariadb='MariaDB'}
export class SetupMessage extends OutgoingMessage {
    userMode: UserModes|undefined;
    admin_user?: { name: string, password: string };
    dbcfg_file: string|undefined;
    db: DBs|undefined;
    db_cfg: object|undefined;

    constructor(
        config: {
            user_mode: UserModes,
            adminuser?: { name: string, password: string },
            dbcfg_file: string,
            db: DBs,
            db_cfg?: {file:string}|{host:string,db:string,dbuser:string,password:string}
        },
        token?: string,
        status?: string
      ) {
        super(MessageType.Setup, token, status);
        const {user_mode,adminuser,dbcfg_file,db,db_cfg} = config;
        this.userMode = user_mode;
        if (user_mode == UserModes.multi) { this.admin_user = adminuser; }
        this.dbcfg_file = dbcfg_file;
        this.db = db;
        this.db_cfg = db_cfg;
    }
}

export class EchoMessage extends OutgoingMessage {
  component: string = '';
  payload: string;

  constructor(component: string, payload: string) {
    super(MessageType.Echo);
    if (component) { this.component = component; }
    this.payload = payload;
  }
}