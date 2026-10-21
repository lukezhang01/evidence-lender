// View models for components, built on the server so every string is
// formatted once, with the backend's locale, currency and time zone.
import type { ExperimentalScore } from '@evidence-lender/backend/contract';
import { scoreProvenanceLine } from './evidence';
import type { Formatters } from './format';
import { type FeatureKind, modelFeatures, notScoredReason } from './labels';

// ---- the credit score (the experimental model's) ---------------------------

// The score as both screens show it, or why there isn't one (rule 3).
export function scoreLabel(
  score: ExperimentalScore,
  format: Formatters,
): { score: string; reason: null } | { score: null; reason: string } {
  if (score.status === 'not_scored') {
    const [have, need] = score.reason === 'no_balance' ? [0, 0] : [score.have, score.need];
    return { score: null, reason: notScoredReason[score.reason](have, need) };
  }
  const shown = score.score < 0.001 ? 'Under 0.001' : score.score > 0.999 ? 'Over 0.999' : format.score(score.score);
  return { score: shown, reason: null };
}

export interface ScoreMover {
  name: string;
  label: string;
  value: string; // this statement, in the product's currency
  typical: string; // the training median, in the training data's currency
  direction: 'up' | 'down';
}

export type ScoreView =
  | { status: 'scored'; score: string; movers: ScoreMover[]; caveats: string[]; provenance: string }
  | { status: 'not_scored'; reason: string; provenance: string };

const MOVERS_SHOWN = 3;

// The reviewer's view: the score, what moved it and how far to trust it.
// `currency` is the product's; the model's training currency comes with the score.
export function buildScoreView(score: ExperimentalScore, format: Formatters, currency: string): ScoreView {
  const provenance = scoreProvenanceLine(score, format);
  const label = scoreLabel(score, format);
  if (score.status === 'not_scored' || label.score === null) {
    return { status: 'not_scored', reason: label.reason ?? '', provenance };
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
    `Trained on ${format.count(training.finishedLoans)} loans at ${training.lender}, ${training.firstLoanYear} to ${training.lastLoanYear} (${training.dataset}); ${format.count(training.notRepaid)} weren’t repaid. It reads ${currency} amounts as ${training.currency}, unconverted.`,
    `On ${format.count(test.loans)} loans it hadn’t seen, it ranked a loan that wasn’t repaid above one that was ${format.percent(test.rocAuc)} of the time (somewhere from ${format.percent(low)} to ${format.percent(high)}; 50% is a coin toss). It hasn’t been tested on anyone who applies here.`,
  ];
  return { status: 'scored', score: label.score, movers, caveats, provenance };
}
