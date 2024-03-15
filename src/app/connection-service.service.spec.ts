import { TestBed } from '@angular/core/testing';
import { Observer } from 'rxjs';
import { WebSocketSubject, WebSocketSubjectConfig } from 'rxjs/webSocket';

import { ConnectionService } from './connection-service.service';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';
import { HelloMessage, LoginMessage, LoginMessageWithSessionToken, Message, MessageType, deserialize } from './Message';

class Subscription {}
class MockWebSocketSubject // extends WebSocketSubject<any> 
{
  subscribe(observer?: Partial<Observer<any>> | undefined): Subscription | null {
    return null;
  }
  // constructor() {
  //     super({} as WebSocketSubjectConfig<any>);
  // }
}
class MockConnectedComponent extends ConnectedComponent {
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

  beforeEach(() => {
    connectionService = new ConnectionService;
    connectionService.BACKEND_ADDRESS = 'MockBackendAddress';
    mockWebSocketSubject = new MockWebSocketSubject();
  });

  it('should be created', () => {
    expect(connectionService).toBeTruthy();
  });

  /*
  it('should generate unique component IDs', () => {
    let ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      let id = service.generateComponentId();
      expect(ids.has(id)).toBeFalse();
      ids.add(id);
    }
  });
  */

  it('should create new connections', () => {
    const spyOnCreateWebSocketSubject = 
      spyOn(ConnectionService.prototype, '_createWebSocketSubject')
      .and.returnValue(mockWebSocketSubject as WebSocketSubject<Message>);
    const spyOnSubscribe = spyOn(mockWebSocketSubject,'subscribe');
    const spyOnExpextHello = spyOn(connectionService,'nextHelloMessage');
    connectionService.getNewConnection(mockSubscriber);
    expect(spyOnCreateWebSocketSubject).toHaveBeenCalledWith(
      connectionService.BACKEND_ADDRESS
    );
    expect(spyOnSubscribe).toHaveBeenCalled();
    expect(spyOnExpextHello).toHaveBeenCalledOnceWith(
      mockWebSocketSubject as WebSocketSubject<Message>,
      mockSubscriber
    );
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