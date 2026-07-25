import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { SidebarConfigurationComponent } from './sidebar-configuration.component';
import { ConfigurationStateService } from '../configuration-state.service';
import { NavigationHeadersService } from '../navigation-headers.service';
import { ConnectionService } from '../connection.service';

describe('SidebarConfigurationComponent', () => {
    let component: SidebarConfigurationComponent;
    let fixture: ComponentFixture<SidebarConfigurationComponent>;
    let configService: ConfigurationStateService;
    let navHeadersService: NavigationHeadersService;

    /** Push a plain list of names into the NavigationHeadersService. */
    const setActiveHeaders = (names: string[]) => {
        navHeadersService.setHeaders(names.map((name) => ({ name, displayName: name })));
    };

    /**
     * Initialise the component (triggers ngOnInit) and advance past the
     * debounceTime(0) so rebuildEntries has run by the time the helper returns.
     * Must be called inside a fakeAsync zone.
     */
    const init = () => {
        fixture.detectChanges();
        tick(0);
    };

    beforeEach(async () => {
        const connectionServiceSpy = {
            getNewConnection: jest.fn(),
            sendMessage: jest.fn(),
            removeConnection: jest.fn(),
        };
        await TestBed.configureTestingModule({
            declarations: [SidebarConfigurationComponent],
            providers: [{ provide: ConnectionService, useValue: connectionServiceSpy }],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SidebarConfigurationComponent);
        component = fixture.componentInstance;
        configService = TestBed.inject(ConfigurationStateService);
        navHeadersService = TestBed.inject(NavigationHeadersService);
        jest.clearAllMocks();
    });

    // ── Creation ───────────────────────────────────────────────────────────────

    it('should create', fakeAsync(() => {
        init();
        expect(component).toBeTruthy();
    }));

    it('starts with empty entry lists when no config and no active headers', fakeAsync(() => {
        init();
        expect(component.visibleEntries).toEqual([]);
        expect(component.hiddenEntries).toEqual([]);
    }));

    // ── rebuildEntries: populating from active headers ─────────────────────────

    it('populates visibleEntries from active headers with default expanded/hidden state', fakeAsync(() => {
        setActiveHeaders(['Invoices', 'Customers']);
        init();

        expect(component.visibleEntries.length).toBe(2);
        expect(component.hiddenEntries.length).toBe(0);
        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Invoices', 'Customers']);
        expect(component.visibleEntries.every((e) => e.expanded)).toBe(true);
        expect(component.visibleEntries.every((e) => !e.hidden)).toBe(true);
        expect(component.visibleEntries.every((e) => e.isCurrentlyActive)).toBe(true);
    }));

    it('places headers with hidden=true in hiddenEntries', fakeAsync(() => {
        configService.setItem('navigation.headers.Archive.hidden', true, false);
        setActiveHeaders(['Invoices', 'Archive']);
        init();

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Invoices']);
        expect(component.hiddenEntries.map((e) => e.name)).toEqual(['Archive']);
    }));

    it('sorts visible entries by configured order', fakeAsync(() => {
        configService.setItem('navigation.headers.Invoices.order', 1);
        configService.setItem('navigation.headers.Customers.order', 0);
        setActiveHeaders(['Invoices', 'Customers']);
        init();

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Customers', 'Invoices']);
    }));

    it('appends unordered entries after ordered ones', fakeAsync(() => {
        configService.setItem('navigation.headers.Customers.order', 0);
        setActiveHeaders(['Invoices', 'Customers']);
        init();

        expect(component.visibleEntries[0].name).toBe('Customers');
        expect(component.visibleEntries[1].name).toBe('Invoices');
    }));

    it('reflects expanded=false config in the entry', fakeAsync(() => {
        configService.setItem('navigation.headers.Invoices.expanded', false);
        setActiveHeaders(['Invoices']);
        init();

        expect(component.visibleEntries[0].expanded).toBe(false);
    }));

    // ── rebuildEntries: config-only headers ───────────────────────────────────

    it('includes config-only headers and marks them as not currently active', fakeAsync(() => {
        configService.setItem('navigation.headers.OldHeader.order', 0);
        setActiveHeaders(['Invoices']);
        init();

        const oldEntry = component.visibleEntries.find((e) => e.name === 'OldHeader');
        expect(oldEntry).toBeDefined();
        expect(oldEntry!.isCurrentlyActive).toBe(false);
        expect(oldEntry!.displayName).toBe('OldHeader'); // falls back to name

        const invoicesEntry = component.visibleEntries.find((e) => e.name === 'Invoices');
        expect(invoicesEntry!.isCurrentlyActive).toBe(true);
    }));

    // ── Reactive rebuild ───────────────────────────────────────────────────────

    it('rebuilds entries when active headers change after init', fakeAsync(() => {
        init();
        expect(component.visibleEntries.length).toBe(0);

        setActiveHeaders(['Invoices']);
        tick(0); // flush new debounce triggered by headers$ emission

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Invoices']);
    }));

    it('rebuilds entries when config changes after init', fakeAsync(() => {
        setActiveHeaders(['Invoices', 'Customers']);
        init();
        expect(component.visibleEntries.length).toBe(2);

        configService.setItem('navigation.headers.Customers.hidden', true, false);
        tick(0);

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Invoices']);
        expect(component.hiddenEntries.map((e) => e.name)).toEqual(['Customers']);
    }));

    // ── moveUp / moveDown ──────────────────────────────────────────────────────

    it('moveUp swaps adjacent entries and persists the new order', fakeAsync(() => {
        configService.setItem('navigation.headers.A.order', 0);
        configService.setItem('navigation.headers.B.order', 1);
        setActiveHeaders(['A', 'B']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.moveUp(1);

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['B', 'A']);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.B.order', 0);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.A.order', 1);
        tick(0); // flush pending debounce timers
    }));

    it('moveDown swaps adjacent entries and persists the new order', fakeAsync(() => {
        configService.setItem('navigation.headers.A.order', 0);
        configService.setItem('navigation.headers.B.order', 1);
        setActiveHeaders(['A', 'B']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.moveDown(0);

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['B', 'A']);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.B.order', 0);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.A.order', 1);
        tick(0);
    }));

    it('moveUp is a no-op at index 0', fakeAsync(() => {
        setActiveHeaders(['A', 'B']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.moveUp(0);

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['A', 'B']);
        expect(setItemSpy).not.toHaveBeenCalled();
    }));

    it('moveDown is a no-op at the last index', fakeAsync(() => {
        setActiveHeaders(['A', 'B']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.moveDown(1);

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['A', 'B']);
        expect(setItemSpy).not.toHaveBeenCalled();
    }));

    // ── toggleExpanded ─────────────────────────────────────────────────────────

    it('toggleExpanded persists false when entry is currently expanded', fakeAsync(() => {
        setActiveHeaders(['Invoices']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        // Default expanded=true, so toggling should store false.
        component.toggleExpanded(component.visibleEntries[0]);

        expect(setItemSpy).toHaveBeenCalledWith(
            'navigation.headers.Invoices.expanded',
            false,
            true
        );
    }));

    it('toggleExpanded persists true when entry is currently collapsed', fakeAsync(() => {
        configService.setItem('navigation.headers.Invoices.expanded', false);
        setActiveHeaders(['Invoices']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.toggleExpanded(component.visibleEntries[0]);

        // true === default (true) → setItem removes the key
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.Invoices.expanded', true, true);
    }));

    // ── makeHidden ─────────────────────────────────────────────────────────────

    it('makeHidden moves entry from visible to hidden and persists hidden=true', fakeAsync(() => {
        setActiveHeaders(['Invoices', 'Customers']);
        init();

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.makeHidden(0); // hide 'Invoices'

        expect(component.visibleEntries.map((e) => e.name)).toEqual(['Customers']);
        expect(component.hiddenEntries.map((e) => e.name)).toEqual(['Invoices']);
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.Invoices.hidden', true, false);
        tick(0);
    }));

    // ── makeVisible ────────────────────────────────────────────────────────────

    it('makeVisible moves entry from hidden to visible and persists hidden=false', fakeAsync(() => {
        configService.setItem('navigation.headers.Archive.hidden', true, false);
        setActiveHeaders(['Invoices', 'Archive']);
        init();

        expect(component.hiddenEntries.map((e) => e.name)).toEqual(['Archive']);

        const setItemSpy = jest.spyOn(configService, 'setItem');
        component.makeVisible(0); // reveal 'Archive'

        expect(component.hiddenEntries).toEqual([]);
        expect(component.visibleEntries.map((e) => e.name)).toContain('Archive');
        expect(setItemSpy).toHaveBeenCalledWith('navigation.headers.Archive.hidden', false, false);
        tick(0);
    }));

    // ── close ──────────────────────────────────────────────────────────────────

    it('emits close event when onClose is called', fakeAsync(() => {
        init();
        const closeSpy = jest.spyOn(component.close, 'emit');

        component.onClose();

        expect(closeSpy).toHaveBeenCalledTimes(1);
    }));
});
