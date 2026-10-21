import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { evidenceRecords } from './fixtures.ts';
import { canonicalJson, sealItems } from './seal.ts';

describe('canonicalJson', () => {
  it('sorts keys at every level and drops undefined properties', () => {
    assert.equal(
      canonicalJson({ b: 1, a: [true, null, 'x', { d: 2, c: undefined, b: 0.5 }] }),
      '{"a":[true,null,"x",{"b":0.5,"d":2}],"b":1}',
    );
  });

  it('does not depend on key insertion order', () => {
    assert.equal(canonicalJson({ x: 1, y: { p: 1, q: 2 } }), canonicalJson({ y: { q: 2, p: 1 }, x: 1 }));
  });

  it('rejects values JSON cannot represent exactly', () => {
    assert.throws(() => canonicalJson(Number.NaN));
    assert.throws(() => canonicalJson([undefined]));
    assert.throws(() => canonicalJson({ f: () => 1 }));
  });
});

describe('sealItems', () => {
  const items = evidenceRecords[0]!.items;

  it('is sha256 over the canonical JSON of the items', () => {
    const expected = createHash('sha256').update(canonicalJson(items)).digest('hex');
    assert.equal(sealItems(items), expected);
    assert.match(sealItems(items), /^[0-9a-f]{64}$/);
  });

  it('changes when any fact changes', () => {
    const edited = items.map((item, i) => (i === 0 ? { ...item, statement: `${item.statement}.` } : item));
    assert.notEqual(sealItems(edited), sealItems(items));
  });
});
