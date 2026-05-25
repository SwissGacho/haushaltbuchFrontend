import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

import { ListComponent } from './list.component';
import { ConnectionService } from '../connection.service';
import { MessageType } from '../messages/Message';

@Component({
    selector: 'app-header-sublist',
    template: '',
    standalone: false,
})
class HeaderSublistStubComponent {
    @Input() header: string | null = null;
    @Input() parentObject: unknown;
}

describe('ListComponent', () => {
    let component: ListComponent;
    let fixture: ComponentFixture<ListComponent>;
    let connectionServiceSpy: Pick<
        ConnectionService,
        'getNewConnection' | 'sendMessage' | 'removeConnection'
    >;

    beforeEach(async () => {
        connectionServiceSpy = {
            getNewConnection: jest.fn(),
            sendMessage: jest.fn(),
            removeConnection: jest.fn(),
        };

        await TestBed.configureTestingModule({
            declarations: [ListComponent, HeaderSublistStubComponent],
            providers: [{ provide: ConnectionService, useValue: connectionServiceSpy }],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ListComponent);
        component = fixture.componentInstance;
        jest.clearAllMocks();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('maps valid matching headers and keeps display_name separate from name', () => {
        component.parentObject = { type: 'Customer', id: 1 };

        component.handleMessages({
            type: MessageType.Object,
            token: 'token',
            object: 'navigationheaders',
            index: 'Customer',
            payload: {
                headers: [
                    { name: 'Account.customer', display_name: 'Accounts' },
                    { name: 'Invoice.customer' },
                ],
            },
        } as any);

        expect(component.headers).toEqual([
            { name: 'Account.customer', displayName: 'Accounts' },
            { name: 'Invoice.customer', displayName: 'Invoice.customer' },
        ]);
    });

    it('ignores object messages with unexpected object', () => {
        component.parentObject = { type: 'Customer', id: 1 };
        component.headers = [{ name: 'Existing', displayName: 'Existing' }];

        component.handleMessages({
            type: MessageType.Object,
            token: 'token',
            object: 'bolist',
            index: 'Customer',
            payload: { headers: [{ name: 'New', display_name: 'New' }] },
        } as any);

        expect(component.headers).toEqual([{ name: 'Existing', displayName: 'Existing' }]);
    });

    it('ignores object messages with unexpected index', () => {
        component.parentObject = { type: 'Customer', id: 1 };
        component.headers = [{ name: 'Existing', displayName: 'Existing' }];

        component.handleMessages({
            type: MessageType.Object,
            token: 'token',
            object: 'navigationheaders',
            index: 'Invoice',
            payload: { headers: [{ name: 'New', display_name: 'New' }] },
        } as any);

        expect(component.headers).toEqual([{ name: 'Existing', displayName: 'Existing' }]);
    });

    it('emits empty and clears headers for invalid payload shape', () => {
        const emptySpy = jest.spyOn(component.empty, 'emit');
        component.parentObject = { type: 'Customer', id: 1 };
        component.headers = [{ name: 'Existing', displayName: 'Existing' }];

        component.handleMessages({
            type: MessageType.Object,
            token: 'token',
            object: 'navigationheaders',
            index: 'Customer',
            payload: { headers: 'not-an-array' },
        } as any);

        expect(component.headers).toEqual([]);
        expect(emptySpy).toHaveBeenCalledTimes(1);
    });

    it('filters malformed headers and emits empty when none are valid', () => {
        const emptySpy = jest.spyOn(component.empty, 'emit');
        component.parentObject = { type: 'Customer', id: 1 };

        component.handleMessages({
            type: MessageType.Object,
            token: 'token',
            object: 'navigationheaders',
            index: 'Customer',
            payload: {
                headers: [{ display_name: 'MissingName' }, { name: '' }, { name: 42 }],
            },
        } as any);

        expect(component.headers).toEqual([]);
        expect(emptySpy).toHaveBeenCalledTimes(1);
    });

    it('builds fetch message with navigationheaders object and parent type index', () => {
        (component as any).token = 'token';
        component.parentObject = { type: 'Customer', id: 7 };
        const sendMessageSpy = jest.spyOn(component as any, 'sendMessage');

        component.fetchNavigationHeaders();

        expect(sendMessageSpy).toHaveBeenCalledTimes(1);
        const sentMessage = sendMessageSpy.mock.calls[0][0] as any;
        expect(sentMessage.object).toBe('navigationheaders');
        expect(sentMessage.index).toBe('Customer');
    });

    it('template binds displayName for rendering and name for sublist input', () => {
        const templatePath = path.resolve(__dirname, './list.component.html');
        const template = fs.readFileSync(templatePath, 'utf8');

        expect(template).toContain('{{ header.displayName }}');
        expect(template).toContain('[header]="header.name"');
        expect(template).toContain('[parentObject]="parentObject"');
    });
});
