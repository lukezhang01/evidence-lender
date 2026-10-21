import type { EvidenceItem, EvidenceRecord, RecordValue } from '@evidence-lender/backend/contract';
import type { Formatters } from './format';
import { outcomeLabel, sourceTypeLabel } from './labels';

// Facts are every sealed item, uploads included. Sources are the distinct
// places facts came from; derived facts are computed, not a source.
export function summarizeRecord(record: EvidenceRecord) {
  const sources = new Set(
    record.items
      .filter((item) => item.sourceType !== 'derived')
      .map((item) => `${item.sourceType}:${item.sourceRef}`),
  );
  return { factCount: record.items.length, sourceCount: sources.size };
}

export function shortHash(sha256: string) {
  return `${sha256.slice(0, 4)}…${sha256.slice(-4)}`;
}

// Every provenance line carries source type, reference and time (rule 1).
// `compact` drops the readable detail where space is tight; never the three parts.
export function provenanceLine(item: EvidenceItem, format: Formatters, { compact = false } = {}) {
  const when = item.sourceType === 'derived' ? 'computed' : 'retrieved';
  return [
    sourceTypeLabel[item.sourceType],
    ...(compact ? [] : [item.sourceDetail]),
    `ref ${item.sourceRef}`,
    `${when} ${format.dateTime(item.retrievedAt)}`,
  ].join(' · ');
}

export function recordValue(value: RecordValue, format: Formatters) {
  return value.kind === 'money' ? format.money(value.amount) : outcomeLabel[value.outcome];
}

export const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
