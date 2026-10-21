import type { EvidenceItem, EvidenceRecord } from '@evidence-lender/backend/contract';
import type { Formatters } from './format';
import { sourceTypeLabel } from './labels';

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
export function provenanceLine(item: EvidenceItem, format: Formatters) {
  const when = item.sourceType === 'derived' ? 'computed' : 'retrieved';
  return [
    sourceTypeLabel[item.sourceType],
    item.sourceDetail,
    `ref ${item.sourceRef}`,
    `${when} ${format.dateTime(item.retrievedAt)}`,
  ].join(' · ');
}
