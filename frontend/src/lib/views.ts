// View models for client components, built on the server so every string is
// formatted once, with the backend's locale, currency and time zone.
import type { DraftEvidence, EvidenceCategory, ExperimentalScore } from '@evidence-lender/backend/contract';
import { provenanceLine, scoreProvenanceLine, statementLine } from './evidence';
import type { Formatters } from './format';
import { categories, type FeatureKind, figures, modelFeatures, notScoredReason } from './labels';

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

// ---- experimental score (reviewers only) ----------------------------------

export interface ScoreMover {
  name: string;
  label: string;
  value: string; // this statement, in the product's currency
  typical: string; // the training median, in the training data's currency
  direction: 'up' | 'down';
}

export type ExperimentalView =
  | { status: 'scored'; score: string; movers: ScoreMover[]; caveats: string[]; provenance: string }
  | { status: 'not_scored'; reason: string; provenance: string };

const MOVERS_SHOWN = 3;

// `currency` is the product's; the model's training currency comes with the score.
export function buildExperimentalView(score: ExperimentalScore, format: Formatters, currency: string): ExperimentalView {
  const provenance = scoreProvenanceLine(score, format);
  if (score.status === 'not_scored') {
    const [have, need] = score.reason === 'no_balance' ? [0, 0] : [score.have, score.need];
    return { status: 'not_scored', reason: notScoredReason[score.reason](have, need), provenance };
  }

  const { training, test } = score.model;
  const show = (kind: FeatureKind, n: number, moneyCurrency: string) => {
    switch (kind) {
      case 'money':
        return format.wholeMoneyIn(n, moneyCurrency);
      case 'count':
        return format.count(Math.round(n));
      case 'days':
        return `${format.count(Math.round(n))} days`;
      case 'share':
        return format.percent(n);
      case 'ratio':
        return format.decimal(n);
    }
  };
  const movers = [...score.features]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, MOVERS_SHOWN)
    .map((f) => {
      const { label, kind } = modelFeatures[f.name];
      return {
        name: f.name,
        label,
        value: f.value === null ? 'has none, so the model used the training median' : show(kind, f.value, currency),
        typical: show(kind, f.trainingMedian, training.currency),
        direction: f.contribution > 0 ? ('up' as const) : ('down' as const),
      };
    });
  const [low, high] = test.rocAucInterval;
  const caveats = [
    `It learned from ${format.count(training.finishedLoans)} finished loans at ${training.lender} (the ${training.dataset} data), made ${training.firstLoanYear} to ${training.lastLoanYear}. ${format.count(training.notRepaid)} weren’t repaid.`,
    `On ${format.count(test.loans)} of those loans it hadn’t seen (${format.count(test.notRepaid)} not repaid), it scored a loan that wasn’t repaid above one that was ${format.percent(test.rocAuc)} of the time. With so few loans, the true figure could be anywhere from ${format.percent(low)} to ${format.percent(high)}; 50% would be a coin toss.`,
    `Amounts aren’t converted: the model reads ${currency} amounts as if they were ${training.currency}.`,
    'It hasn’t been tested on anyone who applies here.',
  ];
  const shown = score.score < 0.001 ? 'Under 0.001' : score.score > 0.999 ? 'Over 0.999' : format.score(score.score);
  return { status: 'scored', score: shown, movers, caveats, provenance };
}
