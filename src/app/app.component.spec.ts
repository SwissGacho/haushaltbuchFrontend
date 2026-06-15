import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import * as rxjs from 'rxjs';
import { AppComponent } from './app.component';
import { Message, MessageType } from './messages/Message';
import { WelcomeMessage, ByeMessage, HelloMessage } from './messages/admin.messages';
import { ConnectionService } from './connection.service';
import { ConfigurationStateService } from './configuration-state.service';

class MockConnectionService {
    getNewConnection(
        subscriber: AppComponent,
        loginSubjectOrObserveHandshake?: rxjs.Subject<any> | boolean,
        isPrimary?: boolean
    ) {}
    removeConnection(componentId: string): void {}
}

class MockConfigurationStateService {
    private readonly values = new Map<string, unknown>();

    getItem<T>(key: string): T | undefined {
        return this.values.get(key) as T | undefined;
    }

    setItem(key: string, value: unknown): void {
        this.values.set(key, value);
    }
}

describe('AppComponent', () => {
    let fixture: ComponentFixture<any>;
    let appComponent: AppComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RouterTestingModule],
            declarations: [AppComponent],
            providers: [
                // AppComponent,
                { provide: ConnectionService, useClass: MockConnectionService },
                { provide: ConfigurationStateService, useClass: MockConfigurationStateService },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(AppComponent);
        appComponent = fixture.componentInstance;
    });

    it('should create the app', () => {
        expect(appComponent).toBeTruthy();
        expect(appComponent.componentID).toContain('AppComponent_');
    });

    it(`should have as title 'haushaltbuchFrontend'`, () => {
        expect(appComponent.title).toEqual('haushaltbuchFrontend');
    });

    /*
  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.content span')?.textContent).toContain('haushaltbuchFrontend app is running!');
  });
  */

    it('should create connection on init', () => {
        const conSrv = fixture.debugElement.injector.get(ConnectionService);
        const spyOnGetNewConn = jest.spyOn(conSrv, 'getNewConnection');
        const spyOnRemoveConn = jest.spyOn(conSrv, 'removeConnection');
        expect(appComponent.connected).toBe(false);
        appComponent.ngOnInit();
        expect(spyOnGetNewConn).toHaveBeenCalledWith(appComponent, true, true);
        expect(appComponent.connected).toBe(true);
        expect(spyOnRemoveConn).not.toHaveBeenCalled();
    });

    it('should restore sidebar width from configuration state on init', () => {
        const configSrv = fixture.debugElement.injector.get(ConfigurationStateService);
        const setItemSpy = jest.spyOn(configSrv, 'setItem');
        jest.spyOn(configSrv, 'getItem').mockReturnValue(360);

        appComponent.ngOnInit();

        expect(appComponent.sidebarWidth).toBe(360);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.sidebar.width', 360, 280);
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

    it('should remove connection on destroy', () => {
        const conSrv = fixture.debugElement.injector.get(ConnectionService);
        const spyOnRemoveConn = jest.spyOn(conSrv, 'removeConnection');
        appComponent.ngOnInit();
        expect(spyOnRemoveConn).not.toHaveBeenCalled();
        appComponent.ngOnDestroy();
        expect(spyOnRemoveConn).toHaveBeenCalled();
    });

    it('should activate Login when receiving Hello message', () => {
        const mockHelloMessage = new HelloMessage({ type: MessageType.Hello, token: 'mockToken' });
        expect(appComponent.activateLoginComponent).toBe(false);
        appComponent.handleMessages(mockHelloMessage);
        expect(appComponent.activateLoginComponent).toBe(true);
    });

    it('should deactivate Login when receiving Welcome message', () => {
        const mockHelloMessage = new HelloMessage({ type: MessageType.Hello, token: 'mockToken' });
        const mockWelcomeMessage = new WelcomeMessage({
            type: MessageType.Welcome,
            token: 'mockToken',
            ses_token: 'mockSession',
        });
        expect(appComponent.activateLoginComponent).toBe(false);
        appComponent.handleMessages(mockHelloMessage);
        expect(appComponent.activateLoginComponent).toBe(true);
        appComponent.handleMessages(mockWelcomeMessage);
        expect(appComponent.activateLoginComponent).toBe(false);
    });
});
