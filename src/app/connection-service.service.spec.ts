import { TestBed } from '@angular/core/testing';
// import { EMPTY } from '../observable/empty';
// import { Observer, take, skip } from 'rxjs';
import * as rxjs  from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';

import { ConnectionService, Logger } from './connection-service.service';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';
import { HelloMessage, IncomingMessage, LoginMessage, Message, MessageType } from './Message';

class Subscription {}
class MockWebSocketSubject // extends WebSocketSubject<any> 
{
  pipe(op1: any, ...ops: any[]): MockWebSocketSubject { return this; }
  subscribe(observer?: Partial<rxjs.Observer<any>> | undefined): Subscription | null {
    return null;
  }
  // constructor() {
  //     super({} as WebSocketSubjectConfig<any>);
  // }
}
class MockConnectedComponent extends ConnectedComponent {
  constructor(private connService: ConnectionService) {
    super(connService);
    this.componentID = 'mockComponent';
  }
  protected override token: string | null = null;
  override handleMessages(message: any) {}
  override handleError(error: any) {}
  override handleComplete() {}
  override setToken(token: string): void {}
  getToken() {return this.token; }
}


describe('ConnectionServiceService', () => {
  let connectionService: ConnectionService = null!;
  let mockWebSocketSubject: MockWebSocketSubject;
  let mockSubscriber: MockConnectedComponent;
  let mockSubject: rxjs.Subject<any>;
  let mockTake: rxjs.MonoTypeOperatorFunction<any>;
  let mockSkip: rxjs.MonoTypeOperatorFunction<any>;

  beforeEach(() => {
    connectionService = new ConnectionService;
    connectionService.BACKEND_ADDRESS = 'MockBackendAddress';
    mockWebSocketSubject = new MockWebSocketSubject();
    mockSubscriber = new MockConnectedComponent(connectionService);
    mockSubject = new rxjs.Subject<{}>();
    mockTake = () => rxjs.EMPTY;
    mockSkip = () => rxjs.EMPTY;
  });

  it('should be created', () => {
    expect(connectionService).toBeTruthy();
  });

  function testGetNewConnection(
    mockLoginSubject?: rxjs.Subject<any>,
    observeHandshake?: boolean,
    primary?: boolean
  ) {
    const spyOnDeserialize = spyOn(IncomingMessage,'deserialize');
    const spyOnWebSocket = 
      spyOn(connectionService, 'webSocket')
      .and.returnValue(mockWebSocketSubject as WebSocketSubject<Message>);
    const spyOnAddConnection = spyOn(ConnectionService, 'addConnection')
    const spyOnPipe = spyOn(mockWebSocketSubject, 'pipe').and.callThrough();
    const spyOnSubscribe = spyOn(mockWebSocketSubject,'subscribe');
    const spyOnTake = spyOn(connectionService, 'rxjsTake')
      .and.returnValue(mockTake);
      const spyOnSkip = spyOn(connectionService, 'rxjsSkip')
      .and.returnValue(mockSkip);
    ConnectionService.connections = {};

    // call the tested object
    if (mockLoginSubject) {
      connectionService.getNewConnection(mockSubscriber,mockLoginSubject,primary);
    } else {
      connectionService.getNewConnection(mockSubscriber,observeHandshake,primary);
    }

    expect(spyOnWebSocket).toHaveBeenCalledWith(
      {url:'MockBackendAddress', deserializer: spyOnDeserialize}
    );
    expect(ConnectionService.connections).toBeTruthy();
    expect(ConnectionService.connections).toEqual({});
    expect(spyOnAddConnection).toHaveBeenCalledOnceWith(
      mockWebSocketSubject as WebSocketSubject<Message>,
      mockSubscriber
    );
    expect(spyOnTake).toHaveBeenCalledOnceWith(2);
    expect(spyOnSkip).toHaveBeenCalledOnceWith(observeHandshake ? 0 : 2);
    expect(spyOnPipe).toHaveBeenCalledTimes(2);
    expect(spyOnPipe).toHaveBeenCalledWith(mockTake);
    expect(spyOnPipe).toHaveBeenCalledWith(mockSkip);
    expect(spyOnSubscribe).toHaveBeenCalledTimes(2);
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.next).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.complete).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.error).toBeTruthy();
    const mockInMsg = new IncomingMessage({type: MessageType.Log});
    const arg0Next = spyOnSubscribe.calls.argsFor(0)[0]?.next;
    if (arg0Next) {
      const spyOnHandleMessages = spyOn(mockSubscriber, 'handleMessages');
      arg0Next(mockInMsg);
      expect(spyOnHandleMessages).toHaveBeenCalledTimes(1);
      console.log('callhand: ', spyOnHandleMessages.calls.argsFor(0));
      expect(spyOnHandleMessages).toHaveBeenCalledOnceWith(mockInMsg);
    }
    const arg1Complete = spyOnSubscribe.calls.argsFor(1)[0]?.complete;
    if (arg1Complete) {
      const spyOnHandleComplete = spyOn(mockSubscriber, 'handleComplete');
      arg1Complete();
      expect(spyOnHandleComplete).toHaveBeenCalledOnceWith();
    }
    const arg1Error = spyOnSubscribe.calls.argsFor(1)[0]?.error;
    if (arg1Error) {
      const spyOnHandleError = spyOn(mockSubscriber, 'handleError');
      arg1Error('muck');
      expect(spyOnHandleError).toHaveBeenCalledOnceWith('muck');
    }
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.next).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.complete).toBeFalsy();
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.error).toBeFalsy();
    const arg1Next = spyOnSubscribe.calls.argsFor(1)[0]?.next;
    if (arg1Next) {
      const spyOnHandleHandshake = spyOn(connectionService, 'handleHandshakeMessages');
      arg1Next(mockInMsg );
      expect(spyOnHandleHandshake).toHaveBeenCalledOnceWith(
        mockInMsg,
        {
          service: connectionService,
          connection: mockWebSocketSubject as WebSocketSubject<Message>,
          subscriber: mockSubscriber,
          loginSubject: mockLoginSubject ? mockLoginSubject : ConnectionService.loginBySessionTokenSubject,
          isPrimary: primary==true 
        }
      );
    }
  }
  it('should create new connection and subscribe with credential Subject', () => {
    testGetNewConnection(mockSubject, true);
  });

  it('should create new connection and subscribe without skip', () => {
    testGetNewConnection(undefined, true);
  });

  it('should create new primary connection and subscribe without skip', () => {
    testGetNewConnection(undefined, true, true);
  });

  it('should create new connection and subscribe with skip', () => {
    testGetNewConnection(undefined, false);
  });

  function testHandleHandshakeMessage(msg: Message, primary: boolean) {
    const mockContext = {
      service: connectionService,
      connection: mockWebSocketSubject as WebSocketSubject<Message>,
      subscriber: mockSubscriber,
      loginSubject: mockSubject,
      isPrimary: primary
    };
    const spyOnSetToken = spyOn(mockSubscriber, 'setToken');
    const spyOnPipe = spyOn(mockWebSocketSubject, 'pipe').and.callThrough();
    const spyOnTake = spyOn(connectionService, 'rxjsTake')
      .and.returnValue(mockTake);
    const spyOnSubscribe = spyOn(mockWebSocketSubject,'subscribe');
    const spyOnNext = spyOn(ConnectionService.loginBySessionTokenSubject, 'next');
    const spyOnTakeOverConsole = spyOn(Logger, 'takeOverConsole');

    ConnectionService._sessionToken = '';
    
    connectionService.handleHandshakeMessages(msg, mockContext);
  }

  it('should handle HelloMessage', () => {
    const mockHelloMessage = new HelloMessage({type: MessageType.Hello});
    testHandleHandshakeMessage(mockHelloMessage, false);
  });
});