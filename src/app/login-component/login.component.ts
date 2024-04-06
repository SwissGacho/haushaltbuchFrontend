import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ConnectedComponent } from '../ConnectedComponent/ConnectedComponent.component';
import { ConnectionService } from '../connection-service.service';
import { LoginMessage, OutgoingMessage, WelcomeMessage, LoginCredentials, IncomingMessage } from '../Message';

@Component({
  selector: 'app-login-component',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent extends ConnectedComponent implements OnInit {

  constructor(private specificService:ConnectionService) {
    super(specificService);
    this.componentID='LoginComponent'
  }

  username: string = "";
  @Output() loginSubject = new EventEmitter<LoginCredentials>();

  override handleMessages(message: IncomingMessage): void {
    console.groupCollapsed("Login Component received ", message.type, " message");
    console.log(message);
    console.groupEnd();
  }

  override handleError(error: any): void {
    console.error("Login Component received error");
    throw new Error(error);
  }

  override handleComplete(): void {
    console.warn('Login connection closed.')
  }

  logIn(): void {
    console.log("Login button pressed (", this.username, ')');
    this.loginSubject.emit({user: this.username});
  }

  // Creates the connection to the backend when the component is initialized.
  // The LoginComponent
  override ngOnInit() {
    this.specificService.getNewConnection(this, this.loginSubject);
  }

}
