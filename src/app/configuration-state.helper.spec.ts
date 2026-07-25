import { mapToRecord, recordToMap } from './configuration-state.helper';

// Convenience alias for the (unexported) ConfigValue union used by the helpers.
type CV = string | number | boolean | null;

describe('mapToRecord', () => {
    it('returns an empty object for an empty map', () => {
        expect(mapToRecord(new Map())).toEqual({});
    });

    it('converts a single-segment key to a plain leaf value', () => {
        expect(mapToRecord(new Map<string, CV>([['width', 280]]))).toEqual({ width: 280 });
    });

    it('converts a dotted key to a nested plain object', () => {
        const map = new Map<string, CV>([['navigation.sidebar.width', 280]]);
        expect(mapToRecord(map)).toEqual({ navigation: { sidebar: { width: 280 } } });
    });

    it('converts a key with a selector to a selector-entry array', () => {
        const map = new Map<string, CV>([
            [
                'navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size',
                15,
            ],
        ]);
        expect(mapToRecord(map)).toEqual({
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
    });

    it('merges multiple value properties of the same selector into one entry', () => {
        const map = new Map<string, CV>([
            ['items(id=1).label', 'one'],
            ['items(id=1).order', 0],
        ]);
        expect(mapToRecord(map)).toEqual({
            items: [{ selector: { id: '1' }, value: { label: 'one', order: 0 } }],
        });
    });

    it('creates separate array entries for different selectors', () => {
        const map = new Map<string, CV>([
            ['items(id=1).label', 'one'],
            ['items(id=2).label', 'two'],
        ]);
        const result = mapToRecord(map) as {
            items: Array<{ selector: Record<string, string>; value: Record<string, unknown> }>;
        };
        expect(result.items.length).toBe(2);
        expect(result.items[0]).toEqual({ selector: { id: '1' }, value: { label: 'one' } });
        expect(result.items[1]).toEqual({ selector: { id: '2' }, value: { label: 'two' } });
    });

    it('handles boolean and null leaf values', () => {
        const map = new Map<string, CV>([
            ['feature.enabled', true],
            ['feature.override', null],
        ]);
        expect(mapToRecord(map)).toEqual({
            feature: { enabled: true, override: null },
        });
    });
});

describe('recordToMap', () => {
    it('returns an empty map for an empty object', () => {
        expect(recordToMap({})).toEqual(new Map());
    });

    it('flattens a nested plain object into dot-separated keys', () => {
        const record = { navigation: { sidebar: { width: 280 } } };
        expect(recordToMap(record)).toEqual(
            new Map<string, CV>([['navigation.sidebar.width', 280]])
        );
    });

    it('reconstructs a selector key from a selector-entry array', () => {
        const record = {
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
        };
        const result = recordToMap(record);
        expect(
            result.get(
                'navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size'
            )
        ).toBe(15);
    });

    it('handles multiple entries in the same selector array', () => {
        const record = {
            items: [
                { selector: { id: '1' }, value: { label: 'one' } },
                { selector: { id: '2' }, value: { label: 'two' } },
            ],
        };
        const result = recordToMap(record);
        expect(result.get('items(id=1).label')).toBe('one');
        expect(result.get('items(id=2).label')).toBe('two');
    });

    it('handles multiple value properties per selector entry', () => {
        const record = {
            items: [{ selector: { id: '1' }, value: { label: 'one', order: 0 } }],
        };
        const result = recordToMap(record);
        expect(result.get('items(id=1).label')).toBe('one');
        expect(result.get('items(id=1).order')).toBe(0);
    });

    it('handles boolean and null leaf values', () => {
        const record = { feature: { enabled: true, override: null } };
        const result = recordToMap(record);
        expect(result.get('feature.enabled')).toBe(true);
        expect(result.get('feature.override')).toBeNull();
    });

    it('round-trips through mapToRecord without loss', () => {
        const original = new Map<string, CV>([
            [
                'navigation.sublists(bo=Invoice,parent_bo=Customer,parent_id=42,ref=customer).size',
                15,
            ],
            ['navigation.sidebar.width', 280],
            ['feature.enabled', true],
        ]);
        expect(recordToMap(mapToRecord(original))).toEqual(original);
    });

    it('round-trips a map with multiple selector entries', () => {
        const original = new Map<string, CV>([
            ['items(id=1).label', 'one'],
            ['items(id=1).order', 0],
            ['items(id=2).label', 'two'],
        ]);
        expect(recordToMap(mapToRecord(original))).toEqual(original);
    });
});
