import { Component, OnInit } from '@angular/core';
import { ConnectionService } from './connection-service.service';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';
import { LoginMessage, OutgoingMessage, WelcomeMessage, LoginCredentials, IncomingMessage, MessageType } from './Message';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent extends ConnectedComponent implements OnInit {
  title = 'haushaltbuchFrontend';

  constructor(private specificService:ConnectionService) {
    super(specificService);
    this.setComponentID('AppComponent');
  }

  override handleMessages(message: IncomingMessage): void {
    console.groupCollapsed("App component received ", message.type, " message");
    console.log(message);
    console.groupEnd();
  }
  // Creates the connection to the backend when the component is initialized.
  // The App Component ownes the 'promary connection' that is used by the backend
  // to request actions
  override ngOnInit() {
    this.specificService.getNewConnection(this, true, true);
  }
}
