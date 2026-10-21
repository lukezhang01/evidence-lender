import { createHash } from 'node:crypto';
import type { EvidenceItem } from './contract.ts';

// Canonical JSON: object keys sorted by code unit, no whitespace, undefined
// object properties dropped. For the strings, integers and decimals in evidence
// this matches RFC 8785 (JCS). Anything JSON can't represent exactly is rejected
// rather than silently changed.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Cannot canonicalize number ${value}`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  throw new TypeError(`Cannot canonicalize a value of type ${typeof value}`);
}

export function sealItems(items: EvidenceItem[]): string {
  return createHash('sha256').update(canonicalJson(items), 'utf8').digest('hex');
}
