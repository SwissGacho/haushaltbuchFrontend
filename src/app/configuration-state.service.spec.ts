import { ConfigurationStateService } from './configuration-state.service';
import { ConnectionService } from './connection.service';

describe('ConfigurationStateService', () => {
    const SUBLIST_SIZE_KEY =
        'navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size';

    let service: ConfigurationStateService;
    let mockConnectionService: {
        getNewConnection: jest.Mock;
        sendMessage: jest.Mock;
        removeConnection: jest.Mock;
    };

    beforeEach(() => {
        mockConnectionService = {
            getNewConnection: jest.fn(),
            sendMessage: jest.fn(),
            removeConnection: jest.fn(),
        };
        service = new ConfigurationStateService(
            mockConnectionService as unknown as ConnectionService
        );
    });

    it('stores and returns arbitrary configuration values', () => {
        service.setItem(SUBLIST_SIZE_KEY, 12);
        service.setItem('navigation.sidebar.width', 320);
        service.setItem('feature.experimental.enabled', true);

        expect(service.getItem<number>(SUBLIST_SIZE_KEY)).toBe(12);
        expect(service.getItem<number>('navigation.sidebar.width')).toBe(320);
        expect(service.getItem<boolean>('feature.experimental.enabled')).toBe(true);
    });

    it('removes an entry when value equals provided default', () => {
        service.setItem(SUBLIST_SIZE_KEY, 12);
        service.setItem(SUBLIST_SIZE_KEY, 7, 7);

        expect(service.getItem<number>(SUBLIST_SIZE_KEY)).toBeUndefined();
    });

    it('serializes and reloads configuration entries', () => {
        service.setItem(
            'navigation.sublists(bo=ultimate_bo,parent_bo=root,parent_id=none,ref=none).size',
            11
        );
        service.setItem('navigation.sidebar.width', 280);

        const payload = service.serializeForBackend();
        expect(payload).toEqual({
            navigation: {
                sublists: [
                    {
                        selector: {
                            bo: 'ultimate_bo',
                            parent_bo: 'root',
                            parent_id: 'none',
                            ref: 'none',
                        },
                        value: { size: 11 },
                    },
                ],
                sidebar: { width: 280 },
            },
        });

        const reloadedService = new ConfigurationStateService(
            mockConnectionService as unknown as ConnectionService
        );
        reloadedService.loadFromBackend(payload);

        expect(
            reloadedService.getItem<number>(
                'navigation.sublists(bo=ultimate_bo,parent_bo=root,parent_id=none,ref=none).size'
            )
        ).toBe(11);
        expect(reloadedService.getItem<number>('navigation.sidebar.width')).toBe(280);
    });

    it('emits item updates through observeItem', () => {
        const key = 'navigation.sidebar.width';
        const receivedValues: Array<number | undefined> = [];
        const subscription = service.observeItem<number>(key).subscribe((value) => {
            receivedValues.push(value);
        });

        service.setItem(key, 280);
        service.setItem(key, 320);
        service.removeItem(key);

        expect(receivedValues).toEqual([undefined, 280, 320, undefined]);
        subscription.unsubscribe();
    });

    it('emits whole-state updates through configItems$', () => {
        const mapSnapshots: Array<Array<[string, unknown]>> = [];
        const subscription = service.configItems$.subscribe((mapState) => {
            mapSnapshots.push(Array.from(mapState.entries()));
        });

        service.setItem('a', 1);
        service.setItem('b', true);

        expect(mapSnapshots).toEqual([
            [],
            [['a', 1]],
            [
                ['a', 1],
                ['b', true],
            ],
        ]);
        subscription.unsubscribe();
    });

    it('updates observeItem subscribers when loadFromBackend is called', () => {
        const key = SUBLIST_SIZE_KEY;
        const receivedValues: Array<number | undefined> = [];
        const subscription = service.observeItem<number>(key).subscribe((value) => {
            receivedValues.push(value);
        });

        service.loadFromBackend({
            navigation: {
                sublists: [
                    {
                        selector: {
                            bo: 'Invoice',
                            parent_bo: 'Customer',
                            parent_id: '42',
                            ref: 'customer',
                        },
                        value: { size: 15 },
                    },
                ],
            },
        });
        service.loadFromBackend({});

        expect(receivedValues).toEqual([undefined, 15, undefined]);
        subscription.unsubscribe();
    });

    it('does not emit whole-state updates for no-op changes', () => {
        const mapSnapshots: Array<Array<[string, unknown]>> = [];
        const subscription = service.configItems$.subscribe((mapState) => {
            mapSnapshots.push(Array.from(mapState.entries()));
        });

        service.setItem('a', 1);
        service.setItem('a', 1);
        service.removeItem('missing');
        service.loadFromBackend({ a: 1 }); // same state — must not emit

        expect(mapSnapshots).toEqual([[], [['a', 1]]]);
        subscription.unsubscribe();
    });

    it('loads configuration with multiple selector entries', () => {
        const secondKey =
            'navigation.sublists(bo=Customer,parent_bo=root,parent_id=none,ref=none).size';

        service.loadFromBackend({
            navigation: {
                sublists: [
                    {
                        selector: {
                            bo: 'Invoice',
                            parent_bo: 'Customer',
                            parent_id: '42',
                            ref: 'customer',
                        },
                        value: { size: 9 },
                    },
                    {
                        selector: {
                            bo: 'Customer',
                            parent_bo: 'root',
                            parent_id: 'none',
                            ref: 'none',
                        },
                        value: { size: 5 },
                    },
                ],
            },
        });

        expect(service.getItem<number>(SUBLIST_SIZE_KEY)).toBe(9);
        expect(service.getItem<number>(secondKey)).toBe(5);
    });
});
