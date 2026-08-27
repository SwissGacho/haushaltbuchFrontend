// console.log('init app component');

import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConnectionService } from './connection.service';
import { ConnectedComponent } from './connected-component/connected.component';
import { IncomingMessage, MessageType, WelcomeMessageType } from './messages/Message';
import { environment } from '../environments/environment';
import { ConfigurationStateService } from './configuration-state.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false,
})
export class AppComponent extends ConnectedComponent implements OnInit, OnDestroy {
    private static readonly SIDEBAR_WIDTH_CONFIG_KEY = 'navigation.sidebar.width';
    private static readonly DEFAULT_SIDEBAR_WIDTH = 280;
    private static readonly SIDEBAR_KEYBOARD_STEP = 16;

    title = 'haushaltbuchFrontend';
    activateAnyComponent = false;
    activateLoginComponent = false;
    activateSetupConfigComponent = false;
    showSidebarConfig = false;
    isLoggedIn = false;
    isMultiUserMode = false;
    username: string | null = null;
    backendUnavailable = false;
    retryInSeconds = 0;
    private isRecoveringFromDisconnect = false;
    private isLoggingOut = false;
    private reconnectTimeout?: ReturnType<typeof setTimeout>;
    private reconnectInterval?: ReturnType<typeof setInterval>;
    frontendVersion = environment.appVersion;
    backendVersion?: string;
    sidebarWidth = AppComponent.DEFAULT_SIDEBAR_WIDTH;
    readonly minSidebarWidth = 180;
    readonly maxSidebarWidth = 700;

    RETRY_INTERVAL = 5; // seconds

    constructor(
        private specificService: ConnectionService,
        private readonly configurationStateService: ConfigurationStateService
    ) {
        super(specificService);
        this.setComponentID('AppComponent');
        console.groupCollapsed(this.componentID, 'constructed');
        console.log('Environment:', environment.production ? 'Production' : 'Development');
        console.log('App Version:', environment.appVersion);
        console.groupEnd();
    }
    private sidebarWidthSubscription: Subscription | null = null;

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        console.debug(message);
        console.groupEnd();
        this.clearReconnectState();
        if (message.type == MessageType.Hello) {
            this.isMultiUserMode = message.status == 'multiUser';
            this.username =
                'authenticated_user' in message && typeof message.authenticated_user === 'string'
                    ? message.authenticated_user
                    : null;
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
            const welcomeMessage = message as WelcomeMessageType;
            if (welcomeMessage.authenticated_user) {
                this.username = welcomeMessage.authenticated_user;
            }
            if ('version_info' in message) {
                const versionInfo = (message as WelcomeMessageType).version_info;
                if (versionInfo && typeof versionInfo === 'object' && 'version' in versionInfo) {
                    this.backendVersion = versionInfo.version;
                }
            }
        }
        console.log('App logged in:', this.componentID);
    }

    // Creates the connection to the backend when the component is initialized.
    // The App Component owns the 'primary connection' that is used by the backend
    // to request actions
    override ngOnInit() {
        this.synchSidebarWidth();
        const observeHandshake = true;
        const isPrimary = true;
        this.getConnection(observeHandshake, isPrimary);
    }

    override ngOnDestroy(): void {
        this.sidebarWidthSubscription?.unsubscribe();
        this.clearReconnectState();
        super.ngOnDestroy();
    }

    startSidebarResize(event: MouseEvent): void {
        event.preventDefault();
        const onMouseMove = (moveEvent: MouseEvent) => {
            this.setSidebarWidth(moveEvent.clientX);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    onSidebarResizerKeydown(event: KeyboardEvent): void {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            this.setSidebarWidth(this.sidebarWidth - AppComponent.SIDEBAR_KEYBOARD_STEP);
            return;
        }

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            this.setSidebarWidth(this.sidebarWidth + AppComponent.SIDEBAR_KEYBOARD_STEP);
            return;
        }

        if (event.key === 'Home') {
            event.preventDefault();
            this.setSidebarWidth(this.minSidebarWidth);
            return;
        }

        if (event.key === 'End') {
            event.preventDefault();
            this.setSidebarWidth(this.maxSidebarWidth);
        }
    }

    private synchSidebarWidth(): void {
        if (this.sidebarWidthSubscription) {
            this.sidebarWidthSubscription.unsubscribe();
        }

        this.sidebarWidthSubscription = this.configurationStateService
            .observeItem<number>(AppComponent.SIDEBAR_WIDTH_CONFIG_KEY)
            .subscribe((storedWidth) => {
                this.setSidebarWidth(this.resolveSidebarWidth(storedWidth));
            });
    }
    private resolveSidebarWidth(width: number | undefined): number {
        if (typeof width !== 'number' || !Number.isFinite(width)) {
            return AppComponent.DEFAULT_SIDEBAR_WIDTH;
        }
        return width;
    }
    private setSidebarWidth(nextWidth: number): void {
        const clampedWidth = Math.min(
            this.maxSidebarWidth,
            Math.max(this.minSidebarWidth, nextWidth)
        );
        this.sidebarWidth = clampedWidth;
        this.configurationStateService.setItem(
            AppComponent.SIDEBAR_WIDTH_CONFIG_KEY,
            clampedWidth,
            AppComponent.DEFAULT_SIDEBAR_WIDTH
        );
    }

    toggleSidebarConfig(): void {
        this.showSidebarConfig = !this.showSidebarConfig;
    }

    override handleError(error: any): void {
        console.error(
            `The App Component received a connection error, retrying in ${this.RETRY_INTERVAL} seconds.`,
            error
        );
        this.recoverFromConnectionLoss();
    }

    override handleComplete(): void {
        console.warn(
            `The App Component connection closed, retrying in ${this.RETRY_INTERVAL} seconds.`
        );
        this.recoverFromConnectionLoss();
    }

    logout(): void {
        this.isLoggingOut = true;
        this.isLoggedIn = false;
        this.username = null;
        this.clearReconnectState();
        sessionStorage.clear();
        sessionStorage.setItem('SuppressAuthenticatedUserLogin', 'true');
        this.specificService.closeAllConnections();
        window.location.reload();
    }

    shouldShowLogout(): boolean {
        return this.isLoggedIn && this.isMultiUserMode;
    }

    private recoverFromConnectionLoss(): void {
        if (this.isLoggingOut || this.isRecoveringFromDisconnect) {
            return;
        }
        this.isRecoveringFromDisconnect = true;
        this.backendUnavailable = true;
        this.retryInSeconds = this.RETRY_INTERVAL;
        this.activateAnyComponent = false;
        this.activateLoginComponent = false;
        this.activateSetupConfigComponent = false;
        this.isLoggedIn = false;
        this.username = null;
        sessionStorage.clear();
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
        }, this.RETRY_INTERVAL * 1000);
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
