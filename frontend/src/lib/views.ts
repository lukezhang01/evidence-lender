// View models for client components, built on the server so every string is
// formatted once, with the backend's locale, currency and time zone.
import type { DraftEvidence, EvidenceCategory } from '@evidence-lender/backend/contract';
import { provenanceLine } from './evidence';
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
  institutionName: string | null;
  tiles: FoundTile[];
  factsByCategory: { key: EvidenceCategory; title: string; facts: FoundFact[] }[];
  factCount: number;
  uploads: FoundFact[];
}

// The borrower sees the same facts the reviewer will: tiles summarize the
// verified facts that carry a figure, and the full list is one tap away.
export function buildFoundView(draft: DraftEvidence, format: Formatters): FoundView {
  const verified = draft.items.filter((i) => i.verified);
  const tiles = figures.flatMap((f) => {
    const item = verified.find((i) => i.figure?.name === f.name);
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
  const toFact = (i: (typeof draft.items)[number]): FoundFact => ({
    id: i.id,
    statement: i.statement,
    provenance: provenanceLine(i, format),
  });
  return {
    institutionName: draft.application.connection?.institutionName ?? null,
    tiles,
    factsByCategory: categories.map((c) => ({
      key: c.key,
      title: c.title,
      facts: verified.filter((i) => i.category === c.key).map(toFact),
    })),
    factCount: verified.length,
    uploads: draft.items.filter((i) => !i.verified).map(toFact),
  };
}
