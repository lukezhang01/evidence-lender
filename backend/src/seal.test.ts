import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import type { EvidenceItem } from './contract.ts';
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
  const items: EvidenceItem[] = [
    {
      id: 'ev-1-rent',
      category: 'willingness',
      statement: 'Payments that look like rent, about $1,650, in 5 of 5 full months',
      sourceType: 'upload',
      sourceRef: 'upload-1',
      sourceDetail: 's.csv: 5 payments mentioning rent or a landlord',
      retrievedAt: '2026-10-21T00:00:00Z',
      verified: false,
      records: [{ date: '2026-10-01', description: 'E-TRANSFER RENT', amount: -1650, balance: 2000 }],
    },
  ];

  it('is sha256 over the canonical JSON of the items', () => {
    const expected = createHash('sha256').update(canonicalJson(items)).digest('hex');
    assert.equal(sealItems(items), expected);
    assert.match(sealItems(items), /^[0-9a-f]{64}$/);
  });

  it('changes when any fact changes', () => {
    const edited = [{ ...items[0]!, statement: `${items[0]!.statement}.` }];
    assert.notEqual(sealItems(edited), sealItems(items));
  });
});
