import { ConfigurationStateService } from './configuration-state.service';

describe('ConfigurationStateService', () => {
    const SUBLIST_SIZE_KEY =
        'navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size';

    let service: ConfigurationStateService;

    beforeEach(() => {
        service = new ConfigurationStateService();
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
                sidebar: {
                    width: 280,
                },
                sublists: [
                    {
                        bo: 'ultimate_bo',
                        parent_bo: 'root',
                        parent_id: 'none',
                        ref: 'none',
                        size: 11,
                    },
                ],
            },
        });

        const reloadedService = new ConfigurationStateService();
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
                        bo: 'Invoice',
                        ref: 'customer',
                        parent_bo: 'Customer',
                        parent_id: '42',
                        size: 15,
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
        service.loadFromBackend([{ key: 'a', value: 1 }]);

        expect(mapSnapshots).toEqual([[], [['a', 1]]]);
        subscription.unsubscribe();
    });

    it('loads legacy key-value array payloads for backward compatibility', () => {
        service.loadFromBackend([
            { key: 'navigation.sidebar.width', value: 320 },
            { key: SUBLIST_SIZE_KEY, value: 9 },
        ]);

        expect(service.getItem<number>('navigation.sidebar.width')).toBe(320);
        expect(service.getItem<number>(SUBLIST_SIZE_KEY)).toBe(9);
    });
});
