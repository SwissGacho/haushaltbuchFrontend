import { Component, OnInit } from '@angular/core';
import { ConnectedComponent } from '../ConnectedComponent/ConnectedComponent.component';
import { ConnectionService } from '../connection-service.service';
import { LoginMessage, WelcomeMessage } from '../Message';

@Component({
  selector: 'app-login-component',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent extends ConnectedComponent implements OnInit {

  constructor(private specificService:ConnectionService) {
    super(specificService);
  }

  username: string = "";

  override handleMessages(message: any): void {
    console.log("Login Component received message");
    console.log(JSON.stringify(message));
    this.specificService.setSessionToken(message.ses_token);
  }

  override handleError(error: any): void {
    console.error("Login Component received error");
    throw new Error(error);
  }

  logIn(): void {
    console.log("Login button pressed");
    this.sendMessage(new LoginMessage(this.username));
  }

}