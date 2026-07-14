// console.log('init app component');

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConnectionService } from './connection.service';
import { ConnectedComponent } from './connected-component/connected.component';
import { IncomingMessage, MessageType, WelcomeMessageType } from './messages/Message';
import { environment } from '../environments/environment';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false,
})
export class AppComponent extends ConnectedComponent implements OnInit, OnDestroy {
    title = 'haushaltbuchFrontend';
    activateAnyComponent = false;
    activateLoginComponent = false;
    activateSetupConfigComponent = false;
    isLoggedIn = false;
    isMultiUserMode = false;
    backendUnavailable = false;
    retryInSeconds = 0;
    private isRecoveringFromDisconnect = false;
    private reconnectTimeout?: ReturnType<typeof setTimeout>;
    private reconnectInterval?: ReturnType<typeof setInterval>;
    frontendVersion = environment.appVersion;
    backendVersion?: string;

    constructor(private specificService: ConnectionService) {
        super(specificService);
        this.setComponentID('AppComponent');
        console.groupCollapsed(this.componentID, 'constructed');
        console.log('Environment:', environment.production ? 'Production' : 'Development');
        console.log('App Version:', environment.appVersion);
        console.groupEnd();
    }

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        console.log(message);
        console.groupEnd();
        this.clearReconnectState();
        if (message.type == MessageType.Hello) {
            this.isMultiUserMode = message.status == 'multiUser';
            // check basic status of backend
            if (message.status == 'noDB') {
                console.log('Open Setup Dialogue');
                this.activateAnyComponent = false;
                this.activateSetupConfigComponent = true;
                this.activateLoginComponent = false;
            } else {
                this.activateLoginComponent = true;
                this.activateAnyComponent = true;
                this.activateSetupConfigComponent = false;
            }
        }
        if (message.type == MessageType.Welcome) {
            // we are logged in, destroy LoginComponent
            this.isLoggedIn = true;
            this.activateLoginComponent = false;
            if ('version_info' in message) {
                const versionInfo = (message as WelcomeMessageType).version_info;
                if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo) {
                    this.backendVersion = versionInfo.version;
                }
            }
        }
        console.log('App logged in:', this);
    }

    // Creates the connection to the backend when the component is initialized.
    // The App Component ownes the 'promary connection' that is used by the backend
    // to request actions
    override ngOnInit() {
        const observeHandshake = true;
        const isPrimary = true;
        this.getConnection(observeHandshake, isPrimary);
    }

    override handleError(error: any): void {
        console.error(
            'The App Component received a connection error, retrying in 5 seconds.',
            error
        );
        this.recoverFromConnectionLoss();
    }

    override handleComplete(): void {
        console.warn('The App Component connection closed, retrying in 5 seconds.');
        this.recoverFromConnectionLoss();
    }

    override ngOnDestroy(): void {
        this.clearReconnectState();
        super.ngOnDestroy();
    }

    logout(): void {
        this.isLoggedIn = false;
        this.clearReconnectState();
        sessionStorage.clear();
        this.specificService.closeAllConnections();
        window.location.reload();
    }

    shouldShowLogout(): boolean {
        return this.isLoggedIn && this.isMultiUserMode;
    }

    private recoverFromConnectionLoss(): void {
        if (this.isRecoveringFromDisconnect) {
            return;
        }
        this.isRecoveringFromDisconnect = true;
        this.backendUnavailable = true;
        this.retryInSeconds = 5;
        this.activateAnyComponent = false;
        this.activateLoginComponent = false;
        this.activateSetupConfigComponent = false;
        this.isLoggedIn = false;
        this.specificService.closeAllConnections();
        this.connected = false;

        this.reconnectInterval = setInterval(() => {
            this.retryInSeconds = Math.max(0, this.retryInSeconds - 1);
        }, 1000);

        this.reconnectTimeout = setTimeout(() => {
            this.clearReconnectState();
            const observeHandshake = true;
            const isPrimary = true;
            this.getConnection(observeHandshake, isPrimary);
        }, 5000);
    }

    private clearReconnectState(): void {
        this.isRecoveringFromDisconnect = false;
        this.backendUnavailable = false;
        this.retryInSeconds = 0;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = undefined;
        }
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = undefined;
        }
    }
}
