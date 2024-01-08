import { Injectable } from '@angular/core';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HelloWorldService {

  connection$?: WebSocketSubject<any>;
  BACKEND_ADDRESS = 'ws://localhost:8765/'

  connectToTest(): Observable<any> {
    return this.connect(this.BACKEND_ADDRESS);
  }

  connect(endpoint: string): Observable<any> {
    // If no connection object has been created yet, return a new connection
    if (!this.connection$) this.connection$ = webSocket(endpoint);
    return this.connection$;
  }

  getHelloWorld(): Observable<any> {
    if (!this.connection$) {
      throw new Error('No connection established!');
    }
    return this.connection$?.multiplex(
      () => ('Hello World'),
      () => ('Goodbye World'),
      (message) => true
    )
  }

  send(data: Object) {
		console.log("HelloWorldService sending message")
		console.log(data)
		if (this.connection$) {
			this.connection$.next(data);
		} else {
			console.error('Connection has not been created, cannot send ' + String(data))
		}
	}

  constructor() { }

}
