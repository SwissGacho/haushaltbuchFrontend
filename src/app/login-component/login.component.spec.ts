import * as rxjs from 'rxjs';
import { LoginComponent } from './login.component';
import { ConnectionService } from '../connection.service';
import { IncomingMessage, MessageType } from '../messages/Message';

describe('LoginComponent', () => {
    let component: LoginComponent;
    let connectionService: {
        getNewConnection: jest.Mock;
        removeConnection: jest.Mock;
    };

    beforeEach(() => {
        connectionService = {
            getNewConnection: jest.fn(),
            removeConnection: jest.fn(),
        };
        ConnectionService.connections = {};
        sessionStorage.clear();
        component = new LoginComponent(connectionService as unknown as ConnectionService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
        expect(component.componentID).toContain('LoginComponent_');
    });

    it('should use SessionToken from sessionStorage on init', () => {
        sessionStorage.setItem('SessionToken', 'session-1');
        const received: any[] = [];
        component.loginSubject.subscribe((value) => received.push(value));

        component.ngOnInit();

        expect(received).toEqual([{ ses_token: 'session-1' }]);
        expect(connectionService.getNewConnection).toHaveBeenCalledWith(
            component,
            component.loginSubject,
            undefined
        );
    });

    it('should show credentials form for non-single-user Hello', () => {
        const message = {
            type: MessageType.Hello,
            token: 'token-1',
            status: 'multiUser',
        } as IncomingMessage;

        component.handleMessages(message);

        expect(component.getLoginCredentials).toBe(true);
    });

    it('should auto-login for singleUser Hello', () => {
        const received: any[] = [];
        component.loginSubject.subscribe((value) => received.push(value));
        const message = {
            type: MessageType.Hello,
            token: 'token-1',
            status: 'singleUser',
        } as IncomingMessage;

        component.handleMessages(message);

        expect(received).toEqual([{}]);
    });

    it('should send entered username when logIn is called', () => {
        const received: any[] = [];
        component.loginSubject.subscribe((value) => received.push(value));
        component.username = 'alice';

        component.logIn();

        expect(received).toEqual([{ user: 'alice' }]);
    });

    it('should reopen connection on Bye and clear SessionToken', () => {
        sessionStorage.setItem('SessionToken', 'stale-token');
        const previousSubject = component.loginSubject;
        ConnectionService.connections[component.componentID] = {
            subject: {} as any,
            subscriber: component,
        };

        component.handleMessages({ type: MessageType.Bye, token: 'token-1' } as IncomingMessage);

        expect(sessionStorage.getItem('SessionToken')).toBeNull();
        expect(component.getLoginCredentials).toBe(true);
        expect(connectionService.removeConnection).toHaveBeenCalledWith(component.componentID);
        expect(component.loginSubject).not.toBe(previousSubject);
        expect(connectionService.getNewConnection).toHaveBeenCalledWith(
            component,
            component.loginSubject,
            undefined
        );
    });

    it('should reopen connection on handleError', () => {
        const previousSubject = component.loginSubject;

        component.handleError(new Error('fail'));

        expect(component.getLoginCredentials).toBe(true);
        expect(component.loginSubject).not.toBe(previousSubject);
        expect(connectionService.getNewConnection).toHaveBeenCalledWith(
            component,
            component.loginSubject,
            undefined
        );
    });
});
