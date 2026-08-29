import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import * as rxjs from 'rxjs';
import { AppComponent } from './app.component';
import { IncomingMessage, MessageType } from './messages/Message';
import { WelcomeMessage, ByeMessage, HelloMessage } from './messages/admin.messages';
import { ConnectionService } from './connection.service';
import { ConfigurationStateService } from './configuration-state.service';

class MockConnectionService {
    getNewConnection = jest.fn();
    removeConnection = jest.fn();
    closeAllConnections = jest.fn();
}

class MockConfigurationStateService {
    private readonly values = new Map<string, unknown>();

    getItem<T>(key: string): T | undefined {
        return this.values.get(key) as T | undefined;
    }

    setItem(key: string, value: unknown, _defaultValue?: unknown): void {
        this.values.set(key, value);
    }

    observeItem<T>(key: string): rxjs.Observable<T | undefined> {
        return new rxjs.BehaviorSubject<T | undefined>(
            this.values.get(key) as T | undefined
        ).asObservable();
    }
}

describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let appComponent: AppComponent;
    let connectionService: MockConnectionService;

    beforeEach(async () => {
        jest.useFakeTimers();
        sessionStorage.clear();
        await TestBed.configureTestingModule({
            imports: [RouterTestingModule],
            declarations: [AppComponent],
            providers: [
                { provide: ConnectionService, useClass: MockConnectionService },
                { provide: ConfigurationStateService, useClass: MockConfigurationStateService },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(AppComponent);
        appComponent = fixture.componentInstance;
        connectionService = fixture.debugElement.injector.get(
            ConnectionService
        ) as unknown as MockConnectionService;
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
    it('should restore sidebar width from configuration state on init', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        jest.spyOn(configSrv, 'observeItem').mockReturnValue(
            new rxjs.BehaviorSubject<number | undefined>(360).asObservable()
        );

        appComponent.ngOnInit();

        expect(appComponent.sidebarWidth).toBe(360);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 360, 280);
    });

    it('should use default sidebar width when no stored value is present', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        jest.spyOn(configSrv, 'observeItem').mockReturnValue(
            new rxjs.BehaviorSubject<number | undefined>(undefined).asObservable()
        );

        appComponent.ngOnInit();

        expect(appComponent.sidebarWidth).toBe(280);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 280, 280);
    });

    it('should persist clamped sidebar width while resizing', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

        appComponent.startSidebarResize(new MouseEvent('mousedown', { clientX: 300 }));

        const mouseMoveHandler = addEventListenerSpy.mock.calls.find(
            ([eventName]) => eventName === 'mousemove'
        )?.[1] as EventListener;
        const mouseUpHandler = addEventListenerSpy.mock.calls.find(
            ([eventName]) => eventName === 'mouseup'
        )?.[1] as EventListener;

        expect(mouseMoveHandler).toBeDefined();
        expect(mouseUpHandler).toBeDefined();

        mouseMoveHandler(new MouseEvent('mousemove', { clientX: 900 }));

        expect(appComponent.sidebarWidth).toBe(700);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 700, 280);

        mouseUpHandler(new MouseEvent('mouseup'));
        expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should resize sidebar with arrow keys', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        appComponent.sidebarWidth = 280;

        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(appComponent.sidebarWidth).toBe(296);

        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(appComponent.sidebarWidth).toBe(280);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 296, 280);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 280, 280);
    });

    it('should move sidebar width to min and max with Home and End keys', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        appComponent.sidebarWidth = 350;

        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'Home' }));
        expect(appComponent.sidebarWidth).toBe(180);

        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'End' }));
        expect(appComponent.sidebarWidth).toBe(700);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 180, 280);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 700, 280);
    });

    it('should clamp keyboard resize to configured bounds', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        jest.spyOn(configSrv, 'setItem');

        appComponent.sidebarWidth = appComponent.minSidebarWidth;
        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        expect(appComponent.sidebarWidth).toBe(appComponent.minSidebarWidth);

        appComponent.sidebarWidth = appComponent.maxSidebarWidth;
        appComponent.onSidebarResizerKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        expect(appComponent.sidebarWidth).toBe(appComponent.maxSidebarWidth);
    });

    it('should remove connection and unsubscribe sidebar subscription on destroy', () => {
        const conSrv = fixture.debugElement.injector.get(ConnectionService);
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const spyOnRemoveConn = jest.spyOn(conSrv, 'removeConnection');
        const subject = new rxjs.BehaviorSubject<number | undefined>(300);
        jest.spyOn(configSrv, 'observeItem').mockReturnValue(subject.asObservable());

        appComponent.ngOnInit();
        expect(appComponent.sidebarWidth).toBe(300);

        appComponent.ngOnDestroy();
        expect(spyOnRemoveConn).toHaveBeenCalled();

        subject.next(500);
        expect(appComponent.sidebarWidth).toBe(300); // subscription was unsubscribed; no update
    });

    it('should activate Login when receiving Hello message', () => {
        const mockHelloMessage = new HelloMessage({ type: MessageType.Hello, token: 'mockToken' });
        expect(appComponent.activateLoginComponent).toBe(false);
    });

    it('should enable login and regular UI for available backend hello', () => {
        const message = {
            type: MessageType.Hello,
            token: 'token-1',
            status: 'multiUser',
            authenticated_user: true,
        } as IncomingMessage;

        appComponent.handleMessages(message);

        expect(appComponent.isMultiUserMode).toBe(true);
        expect(appComponent.activateAnyComponent).toBe(true);
        expect(appComponent.activateSetupConfigComponent).toBe(false);
        expect(appComponent.activateLoginComponent).toBe(true);
        expect(appComponent.username).toBeNull();
    });

    it('should mark logged in and capture backend version on welcome', () => {
        const welcome = new WelcomeMessage({
            type: MessageType.Welcome,
            token: 'token-1',
            authenticated_user: 'alice',
            version_info: { version: '2.5.1' },
        } as any);
        appComponent.activateLoginComponent = true;

        appComponent.handleMessages(welcome);

        expect(appComponent.isLoggedIn).toBe(true);
        expect(appComponent.activateLoginComponent).toBe(false);
        expect(appComponent.username).toBe('alice');
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

    it('should preserve logout suppression when closing connections triggers recovery', () => {
        appComponent.isLoggedIn = true;
        appComponent.isMultiUserMode = true;

        appComponent.logout();
        appComponent.handleError(new Error('connection closed during logout'));

        expect(sessionStorage.getItem('SuppressAuthenticatedUserLogin')).toBe('true');
        expect(appComponent.backendUnavailable).toBe(false);
        expect(connectionService.closeAllConnections).toHaveBeenCalledTimes(1);
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
