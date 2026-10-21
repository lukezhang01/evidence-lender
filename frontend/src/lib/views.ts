// View models for client components, built on the server so every string is
// formatted once, with the backend's locale, currency and time zone.
import type { DraftEvidence, EvidenceCategory } from '@evidence-lender/backend/contract';
import { provenanceLine, statementLine } from './evidence';
import type { Formatters } from './format';
import { categories, figures } from './labels';

export interface FoundTile {
  id: string;
  label: string;
  value: string;
  note: string;
  provenance: string;
}

export interface FoundFact {
  id: string;
  statement: string;
  provenance: string;
}

export interface FoundView {
  statementLine: string;
  tiles: FoundTile[];
  factsByCategory: { key: EvidenceCategory; title: string; facts: FoundFact[] }[];
  factCount: number;
  blindSpots: { title: string; note: string }[];
}

// The borrower sees the same facts the reviewer will: tiles summarize the facts
// that carry a figure, and the full list is one tap away.
export function buildFoundView(draft: DraftEvidence, format: Formatters): FoundView {
  const tiles = figures.flatMap((f) => {
    const item = draft.items.find((i) => i.figure?.name === f.name);
    if (!item?.figure) return [];
    return [
      {
        id: item.id,
        label: f.label,
        value: f.kind === 'money' ? format.wholeMoney(item.figure.value) : format.count(item.figure.value),
        note: item.figure.note,
        provenance: provenanceLine(item, format, { compact: true }),
      },
    ];
  });
  return {
    statementLine: draft.application.statement ? statementLine(draft.application.statement, format) : '',
    tiles,
    factsByCategory: categories.map((c) => ({
      key: c.key,
      title: c.title,
      facts: draft.items
        .filter((i) => i.category === c.key)
        .map((i) => ({ id: i.id, statement: i.statement, provenance: provenanceLine(i, format) })),
    })),
    factCount: draft.items.length,
    blindSpots: draft.blindSpots,
  };
}
