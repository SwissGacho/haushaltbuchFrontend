// console.log('init app component');

import { Component, OnInit } from '@angular/core';
import { ConnectionService } from './connection.service';
import { ConnectedComponent } from './connected-component/connected.component';
import { IncomingMessage, MessageType, WelcomeMessageType } from './messages/Message';
import { environment } from '../environments/environment';
import { ConfigurationStateService } from './configuration-state.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    standalone: false,
})
export class AppComponent extends ConnectedComponent implements OnInit {
    private static readonly SIDEBAR_WIDTH_CONFIG_KEY = 'navigation.sidebar.width';
    private static readonly DEFAULT_SIDEBAR_WIDTH = 280;

    title = 'haushaltbuchFrontend';
    activateAnyComponent = true;
    activateLoginComponent = false;
    activateSetupConfigComponent = false;
    frontendVersion = environment.appVersion;
    backendVersion?: string;
    sidebarWidth = AppComponent.DEFAULT_SIDEBAR_WIDTH;
    readonly minSidebarWidth = 180;
    readonly maxSidebarWidth = 700;

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

    override handleMessages(message: IncomingMessage): void {
        console.groupCollapsed(this.componentID, 'received', message.type, 'message');
        console.log(message);
        console.groupEnd();
        if (message.type == MessageType.Hello) {
            // check basic status of backend
            if (message.status == 'noDB') {
                console.log('Open Setup Dialogue');
                this.activateAnyComponent = false;
                this.activateSetupConfigComponent = true;
            } else {
                this.activateLoginComponent = true;
                this.activateAnyComponent = true;
            }
        }
        if (message.type == MessageType.Welcome) {
            // we are logged in, destroy LoginComponent
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
        this.restoreSidebarWidth();
        const observeHandshake = true;
        const isPrimary = true;
        this.getConnection(observeHandshake, isPrimary);
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

    private restoreSidebarWidth(): void {
        const storedWidth = this.configurationStateService.getItem<unknown>(
            AppComponent.SIDEBAR_WIDTH_CONFIG_KEY
        );

        if (typeof storedWidth !== 'number' || !Number.isFinite(storedWidth)) {
            return;
        }

        this.setSidebarWidth(storedWidth);
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
}
