import { TestBed } from '@angular/core/testing';
import { WebSocketSubject } from 'rxjs/webSocket';

import { ConnectionService } from './connection-service.service';

describe('ConnectionServiceService', () => {
  let service: ConnectionService = null!;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConnectionService);
    service.BACKEND_ADDRESS = 'MockBackendAddress'
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should generate unique component IDs', () => {
    let ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      // @ts-expect-error
      let id = service.generateComponentId();
      expect(ids.has(id)).toBeFalse();
      ids.add(id);
    }
  });

  it('should create new connections', () => {
    let [connection, componentID] = service.getNewConnection();
    expect(connection).toBeTruthy();
    expect(componentID).toBeTruthy();
    expect(componentID).toContain('component-');
  });

  it('should store new connections in service.connections', () => {
    let [connection, componentID] = service.getNewConnection();
    // @ts-expect-error
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
});