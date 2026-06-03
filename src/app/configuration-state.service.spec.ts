import { ConfigurationStateService } from './configuration-state.service';

describe('ConfigurationStateService', () => {
    let service: ConfigurationStateService;

    beforeEach(() => {
        service = new ConfigurationStateService();
    });

    it('stores and returns arbitrary configuration values', () => {
        service.setItem('sublist.size|Customer:42|Invoice.customer', 12);
        service.setItem('ui.sidebar.width', 320);
        service.setItem('feature.experimental.enabled', true);

        expect(service.getItem<number>('sublist.size|Customer:42|Invoice.customer')).toBe(12);
        expect(service.getItem<number>('ui.sidebar.width')).toBe(320);
        expect(service.getItem<boolean>('feature.experimental.enabled')).toBe(true);
    });

    it('removes an entry when value equals provided default', () => {
        service.setItem('sublist.size|Customer:42|Invoice.customer', 12);
        service.setItem('sublist.size|Customer:42|Invoice.customer', 7, 7);

        expect(
            service.getItem<number>('sublist.size|Customer:42|Invoice.customer')
        ).toBeUndefined();
    });

    it('serializes and reloads configuration entries', () => {
        service.setItem('sublist.size|Customer:42|Invoice.customer', 11);
        service.setItem('ui.sidebar.width', 280);

        const payload = service.serializeForBackend();
        const reloadedService = new ConfigurationStateService();
        reloadedService.loadFromBackend(payload);

        expect(reloadedService.getItem<number>('sublist.size|Customer:42|Invoice.customer')).toBe(
            11
        );
        expect(reloadedService.getItem<number>('ui.sidebar.width')).toBe(280);
    });

    it('emits item updates through observeItem', () => {
        const key = 'ui.sidebar.width';
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
        const key = 'sublist.size|Customer:42|Invoice.customer';
        const receivedValues: Array<number | undefined> = [];
        const subscription = service.observeItem<number>(key).subscribe((value) => {
            receivedValues.push(value);
        });

        service.loadFromBackend([{ key, value: 15 }]);
        service.loadFromBackend([]);

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
});
