import { TestBed } from '@angular/core/testing';
// import { EMPTY } from '../observable/empty';
// import { Observer, take, skip } from 'rxjs';
import * as rxjs  from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';

import { ConnectionService } from './connection-service.service';
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
  let mockTake: rxjs.MonoTypeOperatorFunction<any>;
  let mockSkip: rxjs.MonoTypeOperatorFunction<any>;
  const compCounter = 5;

  beforeEach(() => {
    connectionService = new ConnectionService;
    connectionService.BACKEND_ADDRESS = 'MockBackendAddress';
    mockWebSocketSubject = new MockWebSocketSubject();
    mockSubscriber = new MockConnectedComponent(connectionService);
    mockTake = () => rxjs.EMPTY;
    mockSkip = () => rxjs.EMPTY;
  });

  it('should be created', () => {
    expect(connectionService).toBeTruthy();
  });

  function testGetNewConnection(mockLoginSubject?: rxjs.Subject<any>, observeHandshake?: boolean) {
    const spyOnDeserialize = spyOn(IncomingMessage,'deserialize');
    const spyOnWebSocket = 
      spyOn(connectionService, 'webSocket')
      .and.returnValue(mockWebSocketSubject as WebSocketSubject<Message>);
    const spyOnPipe = spyOn(mockWebSocketSubject, 'pipe').and.callThrough();
    const spyOnSubscribe = spyOn(mockWebSocketSubject,'subscribe');
    const spyOnTake = spyOn(connectionService, 'rxjsTake')
      .and.returnValue(mockTake);
      const spyOnSkip = spyOn(connectionService, 'rxjsSkip')
      .and.returnValue(mockSkip);
    connectionService.componentCounter = compCounter;

    // call the tested object
    if (mockLoginSubject) {
      connectionService.getNewConnection(mockSubscriber,mockLoginSubject);
    } else {
      connectionService.getNewConnection(mockSubscriber,observeHandshake);
    }

    expect(spyOnWebSocket).toHaveBeenCalledWith(
      {url:'MockBackendAddress', deserializer: spyOnDeserialize}
    );
    expect(spyOnTake).toHaveBeenCalledOnceWith(2);
    expect(spyOnSkip).toHaveBeenCalledOnceWith(observeHandshake ? 0 : 2);
    expect(spyOnPipe).toHaveBeenCalledTimes(2);
    expect(spyOnPipe).toHaveBeenCalledWith(mockTake);
    expect(spyOnPipe).toHaveBeenCalledWith(mockSkip);
    expect(spyOnSubscribe).toHaveBeenCalledTimes(2);
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.next).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.complete).toBeFalsy();
    expect(spyOnSubscribe.calls.argsFor(0)[0]?.error).toBeFalsy();
    const arg0Next = spyOnSubscribe.calls.argsFor(0)[0]?.next;
    const mockInMsg = new HelloMessage({type: MessageType.Hello, token: ''});
    if (arg0Next) {
      const spyOnHandleHandshake = spyOn(connectionService, 'handleHandshakeMessages');
      arg0Next(mockInMsg);
      expect(spyOnHandleHandshake).toHaveBeenCalledOnceWith(
        mockInMsg,
        {
          component_num: compCounter+1,
          service: connectionService,
          connection: mockWebSocketSubject as WebSocketSubject<Message>,
          subscriber: mockSubscriber,
          loginSubject: mockLoginSubject ? mockLoginSubject : ConnectionService.loginBySessionTokenSubject,
          isPrimary: false 
        }
      );
    }
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.next).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.complete).toBeTruthy();
    expect(spyOnSubscribe.calls.argsFor(1)[0]?.error).toBeTruthy();
    const arg1Next = spyOnSubscribe.calls.argsFor(1)[0]?.next;
    if (arg1Next) {
      const spyOnHandleMessages = spyOn(mockSubscriber, 'handleMessages');
      arg1Next(mockInMsg);
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
  }
  it('should create new connections and subscribe with credential Subject', () => {
    testGetNewConnection(new rxjs.Subject<{}>(), true);
  });

  it('should create new connections and subscribe without skip', () => {
    testGetNewConnection(undefined, true);
  });

  it('should create new connections and subscribe with skip', () => {
    testGetNewConnection(undefined, false);
  });

  /*
  it('should store new connections in service.connections', () => {
    let [connection, componentID] = service.getNewConnection();
    @ts-expect-error
    expect(connection).toBe(service.connections[componentID]);
  });

  it('should return a websocketsubject', () => {
    
    let [connection, componentID] = service.getNewConnection();
    expect(connection instanceof WebSocketSubject).toBeTruthy();
  });
  
  it('should send a message through the connection', () => {
    const senderComponentID = 'component-1';
    const message = { data: 'Hello' };

    // Create a mock WebSocketSubject
    const mockWebSocketSubject = new WebSocketSubject<any>('');
    spyOn(mockWebSocketSubject, 'next');

    // Create a mock connections object
    const mockConnections = { [senderComponentID]: mockWebSocketSubject };

    // Assign the mock connections object to the connections property in the service
    // @ts-expect-error
    service.connections = mockConnections;

    // Call the sendMessage method
    service.sendMessage(senderComponentID, message);

    // Expect the connection's next method to have been called with the message
    // @ts-expect-error
    expect(service.connections[senderComponentID].next).toHaveBeenCalledWith(message);
  });
  
  it('should close a connection before removing it', () => {
    const componentID = 'component-1';

    // Create a mock WebSocketSubject
    const mockWebSocketSubject = new WebSocketSubject<any>('');
    spyOn(mockWebSocketSubject, 'complete');

    // Create a mock connections object
    const mockConnections = { [componentID]: mockWebSocketSubject };

    // Assign the mock connections object to the connections property in the service
    // @ts-expect-error
    service.connections = mockConnections;

    // Call the removeConnection method
    service.removeConnection(componentID);

    // Expect the connection to be completed
    expect(mockWebSocketSubject.complete).toHaveBeenCalled();
  });

  it('should remove a connection', () => {
    const componentID = 'component-1';

    // Create a mock WebSocketSubject
    const mockWebSocketSubject = new WebSocketSubject<any>('');

    // Create a mock connections object
    const mockConnections = { [componentID]: mockWebSocketSubject };

    // Assign the mock connections object to the connections property in the service
    // @ts-expect-error
    service.connections = mockConnections;

    // Call the removeConnection method
    service.removeConnection(componentID);

    // Expect the connection to be removed from the connections object
    // @ts-expect-error
    expect(service.connections[componentID]).toBeUndefined();
  });
  */
});