import { Component, OnInit } from '@angular/core';
import { ConnectionService } from './connection.service';
import { ConnectedComponent } from './ConnectedComponent/ConnectedComponent.component';
import { LoginMessage, OutgoingMessage, WelcomeMessage, LoginCredentials, IncomingMessage, MessageType } from './Message';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent extends ConnectedComponent implements OnInit {
  title = 'haushaltbuchFrontend';
  activateLoginComponent = true;

  constructor(private specificService:ConnectionService) {
    super(specificService);
    this.setComponentID('AppComponent');
  }

  override handleMessages(message: IncomingMessage): void {
    console.groupCollapsed(this.componentID, "received", message.type, "message");
    console.log(message);
    console.groupEnd();
    if (message.type == MessageType.Welcome) {
      // we are logged in, destroy LoginComponent
      this.activateLoginComponent = false;
    }
  }
  // Creates the connection to the backend when the component is initialized.
  // The App Component ownes the 'promary connection' that is used by the backend
  // to request actions
  override ngOnInit() {
    this.specificService.getNewConnection(this, true, true);
  }
}
