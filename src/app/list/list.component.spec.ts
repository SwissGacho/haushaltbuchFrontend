import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';

import { ListComponent } from './list.component';
import { ConnectionService } from '../connection.service';
import { MessageType } from '../messages/Message';
import { ConfigurationStateService } from '../configuration-state.service';
import { NavigationHeadersService } from '../navigation-headers.service';

@Component({
    selector: 'app-header-sublist',
    template: '',
    standalone: false,
})
class HeaderSublistStubComponent {
    @Input() header: string | null = null;
    @Input() parentObject: unknown;
    @Input() visibleItemCount: number | null = null;
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
});

// ─── Config-driven behaviour ──────────────────────────────────────────────────

describe('ListComponent – config-driven behaviour', () => {
    let component: ListComponent;
    let fixture: ComponentFixture<ListComponent>;
    let configService: ConfigurationStateService;
    let navHeadersService: NavigationHeadersService;
    let connectionServiceSpy: Pick<
        ConnectionService,
        'getNewConnection' | 'sendMessage' | 'removeConnection'
    >;

    /** Build a valid Object message carrying the given header rows. */
    const headersMessage = (headers: unknown[]) =>
        ({
            type: MessageType.Object,
            token: 'token',
            object: 'navigationheaders',
            index: '',
            payload: { headers },
        }) as any;

    @Component({ selector: 'app-header-sublist', template: '', standalone: false })
    class StubHeaderSublist {
        @Input() header: string | null = null;
        @Input() parentObject: unknown;
        @Input() visibleItemCount: number | null = null;
    }

    beforeEach(async () => {
        connectionServiceSpy = {
            getNewConnection: jest.fn(),
            sendMessage: jest.fn(),
            removeConnection: jest.fn(),
        };
        await TestBed.configureTestingModule({
            declarations: [ListComponent, StubHeaderSublist],
            providers: [{ provide: ConnectionService, useValue: connectionServiceSpy }],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ListComponent);
        component = fixture.componentInstance;
        configService = TestBed.inject(ConfigurationStateService);
        navHeadersService = TestBed.inject(NavigationHeadersService);
        // Trigger ngOnInit so the config subscription is active.
        fixture.detectChanges();
        jest.clearAllMocks();
    });

    // ── Filtering ──────────────────────────────────────────────────────────────

    it('filters out headers marked as hidden in config', () => {
        configService.setItem('navigation.headers.Invoices.hidden', true, false);

        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Customers' }]));

        expect(component.headers.map((h) => h.name)).toEqual(['Customers']);
    });

    it('keeps all headers visible when no hidden config exists', () => {
        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Customers' }]));

        expect(component.headers.map((h) => h.name)).toEqual(['Invoices', 'Customers']);
    });

    // ── Ordering ───────────────────────────────────────────────────────────────

    it('sorts headers by configured order', () => {
        configService.setItem('navigation.headers.Invoices.order', 1);
        configService.setItem('navigation.headers.Customers.order', 0);

        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Customers' }]));

        expect(component.headers.map((h) => h.name)).toEqual(['Customers', 'Invoices']);
    });

    it('places headers without a configured order after ordered ones', () => {
        configService.setItem('navigation.headers.Customers.order', 0);

        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Customers' }]));

        expect(component.headers.map((h) => h.name)).toEqual(['Customers', 'Invoices']);
    });

    // ── Reactive config updates ────────────────────────────────────────────────

    it('re-filters headers when config changes after headers are received', () => {
        component.handleMessages(headersMessage([{ name: 'A' }, { name: 'B' }, { name: 'C' }]));
        expect(component.headers.map((h) => h.name)).toEqual(['A', 'B', 'C']);

        configService.setItem('navigation.headers.B.hidden', true, false);

        expect(component.headers.map((h) => h.name)).toEqual(['A', 'C']);
    });

    it('re-orders headers when config changes after headers are received', () => {
        component.handleMessages(headersMessage([{ name: 'A' }, { name: 'B' }]));

        configService.setItem('navigation.headers.A.order', 1);
        configService.setItem('navigation.headers.B.order', 0);

        expect(component.headers.map((h) => h.name)).toEqual(['B', 'A']);
    });

    // ── NavigationHeadersService ───────────────────────────────────────────────

    it('publishes all raw headers including hidden ones to NavigationHeadersService', () => {
        configService.setItem('navigation.headers.Archive.hidden', true, false);

        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Archive' }]));

        expect(navHeadersService.getHeaders().map((h) => h.name)).toEqual(['Invoices', 'Archive']);
    });

    // ── Initial expanded state ─────────────────────────────────────────────────

    it('starts header as expanded by default when no config entry exists', () => {
        component.handleMessages(headersMessage([{ name: 'Invoices' }]));

        expect(component.isHeaderExpanded('Invoices')).toBe(true);
    });

    it('starts header as collapsed when config has expanded=false before headers arrive', () => {
        configService.setItem('navigation.headers.Invoices.expanded', false);

        component.handleMessages(headersMessage([{ name: 'Invoices' }]));

        expect(component.isHeaderExpanded('Invoices')).toBe(false);
    });

    it('collapses a header when config sets expanded=false after headers are received', () => {
        component.handleMessages(headersMessage([{ name: 'Invoices' }]));
        expect(component.isHeaderExpanded('Invoices')).toBe(true);

        configService.setItem('navigation.headers.Invoices.expanded', false);

        expect(component.isHeaderExpanded('Invoices')).toBe(false);
    });

    it('expands a header when config removes expanded=false after headers are received', () => {
        configService.setItem('navigation.headers.Invoices.expanded', false);
        component.handleMessages(headersMessage([{ name: 'Invoices' }]));
        expect(component.isHeaderExpanded('Invoices')).toBe(false);

        // Revert to default (expanded) by removing the key via defaultValue trick.
        configService.setItem('navigation.headers.Invoices.expanded', true, true);
        // Trigger a config change that actually modifies the map.
        configService.setItem('navigation.headers.Other.order', 0);

        expect(component.isHeaderExpanded('Invoices')).toBe(true);
    });

    // ── User-toggle protection ─────────────────────────────────────────────────

    it('does not override user-toggled collapse when config changes', () => {
        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Other' }]));
        // User collapses Invoices.
        component.toggleHeader('Invoices');
        expect(component.isHeaderExpanded('Invoices')).toBe(false);

        // Unrelated config change triggers the subscription.
        configService.setItem('navigation.headers.Other.order', 0);

        expect(component.isHeaderExpanded('Invoices')).toBe(false);
    });

    it('does not override user-toggled expand when config sets header to collapsed', () => {
        configService.setItem('navigation.headers.Invoices.expanded', false);
        component.handleMessages(headersMessage([{ name: 'Invoices' }, { name: 'Other' }]));
        expect(component.isHeaderExpanded('Invoices')).toBe(false);

        // User expands it manually.
        component.toggleHeader('Invoices');
        expect(component.isHeaderExpanded('Invoices')).toBe(true);

        // Config still says collapsed; trigger a config change.
        configService.setItem('navigation.headers.Other.order', 1);

        expect(component.isHeaderExpanded('Invoices')).toBe(true);
    });
});
