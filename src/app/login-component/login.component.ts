// console.log('init login component');

import { Component, OnInit, Output } from '@angular/core';
import * as rxjs from 'rxjs';
import { ConnectedComponent } from '../connected-component/connected.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';
import { LoginCredentials } from '../messages/admin.messages';

@Component({
    selector: 'app-login-component',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    standalone: false,
})
export class LoginComponent extends ConnectedComponent implements OnInit {
    getLoginCredentials = false;
    loginFailureReason: string | null = null;
    private authenticatedUserLoginAttempted = false;
    private suppressAuthenticatedUserLogin =
        sessionStorage.getItem('SuppressAuthenticatedUserLogin') === 'true';

    constructor(private specificService: ConnectionService) {
        super(specificService);
        this.setComponentID('LoginComponent');
    }

    username: string = '';
    loginSubject = new rxjs.ReplaySubject<LoginCredentials>();

    private reopenConnectionForLogin(reason?: string): void {
        sessionStorage.removeItem('SessionToken');
        this.getLoginCredentials = true;
        this.loginFailureReason = reason ?? null;

        if (ConnectionService.connections[this.componentID]) {
            this.specificService.removeConnection(this.componentID);
            this.connected = false;
        }

        this.loginSubject = new rxjs.ReplaySubject<LoginCredentials>();
        this.getConnection(this.loginSubject);
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        console.debug(message);
        console.groupEnd();
        if (message.type == MessageType.Hello) {
            const authenticatedUser =
                'authenticated_user' in message && typeof message.authenticated_user === 'string'
                    ? message.authenticated_user
                    : undefined;
            if (
                authenticatedUser &&
                !this.suppressAuthenticatedUserLogin &&
                !this.authenticatedUserLoginAttempted
            ) {
                this.authenticatedUserLoginAttempted = true;
                this.getLoginCredentials = false;
                this.loginFailureReason = null;
                this.loginSubject.next({ user: authenticatedUser });
                return;
            }
            if (authenticatedUser) {
                this.getLoginCredentials = true;
                return;
            }
            let status = message.status;
            if (status == 'singleUser') {
                this.loginFailureReason = null;
                this.loginSubject.next({});
            } else {
                this.getLoginCredentials = true;
            }
        } else if (message.type == MessageType.Bye) {
            this.username = '';
            const reason =
                'reason' in message && typeof message.reason === 'string'
                    ? message.reason
                    : undefined;
            // Automatic or manual login failed; reopen a fresh login connection.
            console.log('Login failed, reopening connection for login; reason:', reason);
            this.reopenConnectionForLogin(reason);
        }
    }

    override handleError(error: any): void {
        console.error('Login Component received error');
        throw new Error(error);
    }

    override handleComplete(): void {
        console.debug('Login connection closed.');
    }

    logIn(): void {
        console.log('Login button pressed (', this.username, ')');
        this.suppressAuthenticatedUserLogin = false;
        sessionStorage.removeItem('SuppressAuthenticatedUserLogin');
        this.loginFailureReason = null;
        this.loginSubject.next({ user: this.username });
    }

    // Creates the connection to the backend when the component is initialized.
    // The LoginComponent
    override ngOnInit() {
        console.debug('LoginComponent initialized:', this.componentID);
        const sessionToken = sessionStorage.getItem('SessionToken');
        if (sessionToken) {
            this.loginSubject.next({ ses_token: sessionToken });
        }
        this.getConnection(this.loginSubject);
    }
}
