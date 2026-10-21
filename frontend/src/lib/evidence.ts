import type { EvidenceItem, EvidenceRecord, StatementSummary } from '@evidence-lender/backend/contract';
import type { Formatters } from './format';
import { sourceTypeLabel } from './labels';

// Facts are every sealed item. Sources are the distinct places they came from.
export function summarizeRecord(record: EvidenceRecord) {
  const sources = new Set(record.items.map((item) => `${item.sourceType}:${item.sourceRef}`));
  return { factCount: record.items.length, sourceCount: sources.size };
}

export function shortHash(sha256: string) {
  return `${sha256.slice(0, 4)}…${sha256.slice(-4)}`;
}

// Every provenance line carries source type, reference and time (rule 1).
// `compact` drops the readable detail where space is tight; never the three parts.
export function provenanceLine(item: EvidenceItem, format: Formatters, { compact = false } = {}) {
  return [
    sourceTypeLabel[item.sourceType],
    ...(compact ? [] : [item.sourceDetail]),
    `ref ${item.sourceRef}`,
    `uploaded ${format.dateTime(item.retrievedAt)}`,
  ].join(' · ');
}

export function statementLine(statement: StatementSummary, format: Formatters) {
  return `${statement.fileName} · ${countLabel(statement.transactionCount, 'transaction', 'transactions')} · ${format.day(statement.firstDate)} to ${format.day(statement.lastDate)}`;
}

export const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
