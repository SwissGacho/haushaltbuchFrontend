import { AppComponent } from './app.component';
import { ConnectionService } from './connection.service';
import { IncomingMessage, MessageType } from './messages/Message';
import { WelcomeMessage } from './messages/admin.messages';

describe('AppComponent', () => {
    let appComponent: AppComponent;
    let connectionService: {
        getNewConnection: jest.Mock;
        removeConnection: jest.Mock;
        closeAllConnections: jest.Mock;
    };

    beforeEach(() => {
        jest.useFakeTimers();
        connectionService = {
            getNewConnection: jest.fn(),
            removeConnection: jest.fn(),
            closeAllConnections: jest.fn(),
        };
        appComponent = new AppComponent(connectionService as unknown as ConnectionService);
        sessionStorage.clear();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('should create the app', () => {
        expect(appComponent).toBeTruthy();
        expect(appComponent.componentID).toContain('AppComponent_');
    });

    it("should have as title 'haushaltbuchFrontend'", () => {
        expect(appComponent.title).toEqual('haushaltbuchFrontend');
    });

    it('should create primary connection on init', () => {
        appComponent.ngOnInit();

        expect(connectionService.getNewConnection).toHaveBeenCalledWith(appComponent, true, true);
        expect(appComponent.connected).toBe(true);
    });

    it('should disable regular UI and show setup for noDB hello', () => {
        const message = {
            type: MessageType.Hello,
            token: 'token-1',
            status: 'noDB',
        } as IncomingMessage;

        appComponent.handleMessages(message);

        expect(appComponent.activateAnyComponent).toBe(false);
        expect(appComponent.activateSetupConfigComponent).toBe(true);
        expect(appComponent.activateLoginComponent).toBe(false);
    });

    it('should enable login and regular UI for available backend hello', () => {
        const message = {
            type: MessageType.Hello,
            token: 'token-1',
            status: 'multiUser',
        } as IncomingMessage;

        appComponent.handleMessages(message);

        expect(appComponent.isMultiUserMode).toBe(true);
        expect(appComponent.activateAnyComponent).toBe(true);
        expect(appComponent.activateSetupConfigComponent).toBe(false);
        expect(appComponent.activateLoginComponent).toBe(true);
    });

    it('should mark logged in and capture backend version on welcome', () => {
        const welcome = new WelcomeMessage({
            type: MessageType.Welcome,
            token: 'token-1',
            version_info: { version: '2.5.1' },
        } as any);
        appComponent.activateLoginComponent = true;

        appComponent.handleMessages(welcome);

        expect(appComponent.isLoggedIn).toBe(true);
        expect(appComponent.activateLoginComponent).toBe(false);
        expect(appComponent.backendVersion).toBe('2.5.1');
    });

    it('should show logout only when logged in and in multi user mode', () => {
        appComponent.isLoggedIn = false;
        appComponent.isMultiUserMode = true;
        expect(appComponent.shouldShowLogout()).toBe(false);

        appComponent.isLoggedIn = true;
        appComponent.isMultiUserMode = false;
        expect(appComponent.shouldShowLogout()).toBe(false);

        appComponent.isLoggedIn = true;
        appComponent.isMultiUserMode = true;
        expect(appComponent.shouldShowLogout()).toBe(true);
    });

    it('should start retry countdown and reconnect after 5 seconds on error', () => {
        appComponent.activateAnyComponent = true;
        appComponent.activateLoginComponent = true;
        appComponent.isLoggedIn = true;

        appComponent.handleError(new Error('offline'));

        expect(connectionService.closeAllConnections).toHaveBeenCalledTimes(1);
        expect(appComponent.backendUnavailable).toBe(true);
        expect(appComponent.retryInSeconds).toBe(5);
        expect(appComponent.activateAnyComponent).toBe(false);
        expect(appComponent.activateLoginComponent).toBe(false);
        expect(appComponent.isLoggedIn).toBe(false);

        jest.advanceTimersByTime(2000);
        expect(appComponent.retryInSeconds).toBe(3);

        jest.advanceTimersByTime(3000);
        expect(connectionService.getNewConnection).toHaveBeenCalledWith(appComponent, true, true);
        expect(appComponent.backendUnavailable).toBe(false);
        expect(appComponent.retryInSeconds).toBe(0);
    });

    it('should not start duplicate recovery cycles while already recovering', () => {
        appComponent.handleError(new Error('offline'));
        appComponent.handleError(new Error('still offline'));

        expect(connectionService.closeAllConnections).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(5000);
        expect(connectionService.getNewConnection).toHaveBeenCalledTimes(1);
    });

    it('should clear reconnect timers on destroy', () => {
        appComponent.handleError(new Error('offline'));

        appComponent.ngOnDestroy();
        jest.advanceTimersByTime(5000);

        expect(connectionService.getNewConnection).toHaveBeenCalledTimes(0);
        expect(connectionService.removeConnection).toHaveBeenCalledTimes(0);
    });

    it('should remove connection on destroy when currently connected', () => {
        appComponent.ngOnInit();

        appComponent.ngOnDestroy();

        expect(connectionService.removeConnection).toHaveBeenCalledWith(appComponent.componentID);
    });
});
