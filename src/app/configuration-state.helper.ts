// ─── Types ───────────────────────────────────────────────────────────────────

/** Leaf value stored in the config map */
type ConfigValue = string | number | boolean | null;

/** A selector entry produced for a segment like "sublists(bo=x,parent=y)" */
interface SelectorEntry {
    selector: Record<string, string>;
    value: JsonRecord;
}

/** Recursive JSON-able record */
type JsonRecord = {
    [key: string]: ConfigValue | SelectorEntry[] | JsonRecord;
};

// ─── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Split a dot-separated key into segments, but only on dots that are NOT
 * inside parentheses, so "a.b(x=1,y=2).c" → ["a", "b(x=1,y=2)", "c"].
 */
function splitKey(key: string): string[] {
    const segments: string[] = [];
    let depth = 0;
    let start = 0;

    for (let i = 0; i < key.length; i++) {
        if (key[i] === '(') depth++;
        else if (key[i] === ')') depth--;
        else if (key[i] === '.' && depth === 0) {
            segments.push(key.slice(start, i));
            start = i + 1;
        }
    }
    segments.push(key.slice(start));
    return segments;
}

/**
 * Parse a segment into its base name and optional selector.
 *
 * "sublists(bo=testobject,parent_bo=root)" →
 *   { name: "sublists", selector: { bo: "testobject", parent_bo: "root" } }
 *
 * "size" → { name: "size", selector: null }
 */
function parseSegment(segment: string): { name: string; selector: Record<string, string> | null } {
    const parenIdx = segment.indexOf('(');
    if (parenIdx === -1) return { name: segment, selector: null };

    const name = segment.slice(0, parenIdx);
    const inner = segment.slice(parenIdx + 1, segment.lastIndexOf(')'));
    const selector: Record<string, string> = {};

    for (const pair of inner.split(',')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
            selector[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
        }
    }

    return { name, selector };
}

/** Stable JSON stringification of a selector for use as a Map key */
function selectorKey(selector: Record<string, string>): string {
    return JSON.stringify(
        Object.fromEntries(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)))
    );
}

// ─── Map → Record ─────────────────────────────────────────────────────────────

/**
 * Convert a flat config Map (dot-separated keys with optional selectors) into
 * a nested JSON-able record.
 *
 * Segments WITH a selector ("name(k=v,…)") are collapsed into an array of
 * `{ selector, value }` entries on the parent object.
 * Segments WITHOUT a selector become plain nested objects / leaf values.
 */
export function mapToRecord(config: Map<string, ConfigValue>): JsonRecord {
    const root: JsonRecord = {};

    for (const [key, value] of config) {
        const segments = splitKey(key);
        setNestedValue(root, segments, value);
    }

    return root;
}

/**
 * Recursively walk `segments` into `node`, creating intermediate objects and
 * selector-entry arrays as needed, then set the leaf `value`.
 */
function setNestedValue(node: JsonRecord, segments: string[], value: ConfigValue): void {
    const { name, selector } = parseSegment(segments[0]);
    const isLast = segments.length === 1;

    if (selector === null) {
        // ── Plain segment ──────────────────────────────────────────────────────
        if (isLast) {
            node[name] = value;
        } else {
            if (
                typeof node[name] !== 'object' ||
                node[name] === null ||
                Array.isArray(node[name])
            ) {
                node[name] = {};
            }
            setNestedValue(node[name] as JsonRecord, segments.slice(1), value);
        }
    } else {
        // ── Selector segment ───────────────────────────────────────────────────
        // Ensure we have an array at node[name]
        if (!Array.isArray(node[name])) {
            node[name] = [];
        }
        const arr = node[name] as SelectorEntry[];

        // Find or create the entry that matches this selector
        const selKey = selectorKey(selector);
        let entry = arr.find((e) => selectorKey(e.selector) === selKey);
        if (!entry) {
            entry = { selector, value: {} };
            arr.push(entry);
        }

        if (isLast) {
            // The selector IS the leaf — unusual but handle gracefully
            (entry as unknown as Record<string, unknown>)['value'] = value;
        } else {
            setNestedValue(entry.value as JsonRecord, segments.slice(1), value);
        }
    }
}

// ─── Record → Map ─────────────────────────────────────────────────────────────

/**
 * Reconstruct a flat config Map from a nested JSON record produced by
 * `mapToRecord`.
 */
export function recordToMap(record: unknown): Map<string, ConfigValue> {
    const result = new Map<string, ConfigValue>();
    collectEntries(record as JsonRecord, [], result);
    return result;
}

function collectEntries(
    node: JsonRecord | ConfigValue,
    pathSegments: string[],
    result: Map<string, ConfigValue>
): void {
    console.log('collectEntries', pathSegments.join('.'), node);
    // Leaf value
    if (node === null || typeof node !== 'object') {
        result.set(pathSegments.join('.'), node as ConfigValue);
        return;
    }

    // Array → selector entries
    if (Array.isArray(node)) {
        for (const entry of node as SelectorEntry[]) {
            const selectorStr = Object.entries(entry.selector)
                .map(([k, v]) => `${k}=${v}`)
                .join(',');
            // Re-attach the selector to the last pushed segment
            const parentSegments = pathSegments.slice(0, -1);
            const baseName = pathSegments[pathSegments.length - 1];
            const segmentWithSelector = `${baseName}(${selectorStr})`;

            collectEntries(
                entry.value as JsonRecord,
                [...parentSegments, segmentWithSelector],
                result
            );
        }
        return;
    }

    // Plain object
    for (const [key, child] of Object.entries(node as JsonRecord)) {
        collectEntries(child as JsonRecord | ConfigValue, [...pathSegments, key], result);
    }
}

// ─── Demo ─────────────────────────────────────────────────────────────────────

// const config = new Map<string, ConfigValue>([
//     ['navigation.sublists(bo=testobject,parent_bo=root,parent_id=none,ref=none).size', 6],
//     ['navigation.sublists(bo=testobject,parent_bo=root,parent_id=none,ref=none).visible', true],
//     ['navigation.sublists(bo=otherobject,parent_bo=root,parent_id=none,ref=none).size', 3],
//     ['navigation.title', 'Main Nav'],
//     ['sidebar.width', 240],
// ]);

// const record = mapToRecord(config);
// console.log('── mapToRecord ──────────────────────────────');
// console.log(JSON.stringify(record, null, 2));

// const restored = recordToMap(record);
// console.log('\n── recordToMap (round-trip) ─────────────────');
// for (const [k, v] of restored) {
//     console.log(`  ${k} = ${JSON.stringify(v)}`);
// }

// // Verify round-trip integrity
// const originalKeys = [...config.keys()].sort();
// const restoredKeys = [...restored.keys()].sort();
// console.log('\n── Round-trip check ─────────────────────────');
// console.log('Keys match:', JSON.stringify(originalKeys) === JSON.stringify(restoredKeys));
// console.log(
//     'Values match:',
//     originalKeys.every((k) => config.get(k) === restored.get(k))
// );
