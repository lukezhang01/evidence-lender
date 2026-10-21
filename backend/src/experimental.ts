// The experimental score: the course notebook's cash-flow model
// (Berka_Cashflow_PD_Colab.ipynb), shown as the credit score to the reviewer
// and, once submitted, to the applicant.
//
// It proposes no outcome, amount or reasons, and the reviewer still decides and
// writes why (rules 2 and 5). It was trained on 1990s Czech loans in koruna and
// hasn't been tested on anyone here; both screens say so next to it.
//
// config/experimental-model.json is written by model/export.py, which rebuilds
// the notebook's model and checks its results against the notebook's.
// cashflowFeatures() ports the notebook's cashflow_features(); the tests check
// it against the Python on invented statements (experimental.parity.json).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ExperimentalScore, ModelFeature, ModelFeatureName, ModelSummary, SourceRecord } from './contract.ts';
import { canonicalJson } from './seal.ts';
import type { ParsedStatement } from './statement.ts';

// The feature builder looks at six 30-day periods, and the last 90 and 30 days.
const WINDOW_DAYS = 180;
const MODEL_URL = new URL('../config/experimental-model.json', import.meta.url);

export const FEATURE_NAMES: readonly ModelFeatureName[] = [
  'tx_count_180d',
  'history_days_180d',
  'observed_months_180d',
  'total_inflow_180d',
  'total_outflow_180d',
  'net_flow_180d',
  'avg_monthly_inflow_180d',
  'avg_monthly_outflow_180d',
  'avg_monthly_net_180d',
  'std_monthly_net_180d',
  'income_cv_180d',
  'inflow_months_180d',
  'median_tx_balance_180d',
  'min_tx_balance_180d',
  'median_daily_observed_balance_90d',
  'recent_large_inflow_share_30d',
  'negative_balance_tx_share_180d',
  'median_inflow_size_180d',
];

// The file model/export.py writes.
interface ModelFile {
  id: string;
  name: string;
  purpose: string;
  notebook: string;
  windowDays: number;
  minimumTransactions: number;
  training: ModelSummary['training'] & Record<string, unknown>;
  test: ModelSummary['test'] & Record<string, unknown>;
  features: { name: ModelFeatureName; median: number; center: number; scale: number; coefficient: number }[];
  intercept: number;
}

export interface ExperimentalModel {
  summary: ModelSummary;
  minimumTransactions: number;
  features: ModelFile['features'];
  intercept: number;
}

export function loadExperimentalModel(url: URL = MODEL_URL): ExperimentalModel {
  const file = JSON.parse(readFileSync(url, 'utf8')) as ModelFile;
  const problems = validateModelFile(file);
  if (problems.length > 0) {
    throw new Error(`Invalid experimental model (${url.pathname}):\n- ${problems.join('\n- ')}`);
  }
  const { training: t, test } = file;
  return {
    summary: {
      id: file.id,
      sha256: createHash('sha256').update(canonicalJson(file), 'utf8').digest('hex'),
      name: file.name,
      purpose: file.purpose,
      notebook: file.notebook,
      windowDays: file.windowDays,
      training: {
        dataset: t.dataset,
        lender: t.lender,
        currency: t.currency,
        firstLoanYear: t.firstLoanYear,
        lastLoanYear: t.lastLoanYear,
        finishedLoans: t.finishedLoans,
        notRepaid: t.notRepaid,
      },
      test: { loans: test.loans, notRepaid: test.notRepaid, rocAuc: test.rocAuc, rocAucInterval: test.rocAucInterval },
    },
    minimumTransactions: file.minimumTransactions,
    features: file.features,
    intercept: file.intercept,
  };
}

export function validateModelFile(m: ModelFile): string[] {
  const problems: string[] = [];
  const isNumber = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  const isWholePositive = (n: unknown) => Number.isInteger(n) && (n as number) > 0;
  const isNonEmpty = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

  for (const key of ['id', 'name', 'purpose', 'notebook'] as const) {
    if (!isNonEmpty(m[key])) problems.push(`${key} is required`);
  }
  if (m.windowDays !== WINDOW_DAYS) problems.push(`windowDays must be ${WINDOW_DAYS}, the window the features use`);
  if (!isWholePositive(m.minimumTransactions)) problems.push('minimumTransactions must be a positive whole number');
  if (!isNumber(m.intercept)) problems.push('intercept must be a number');

  const names = Array.isArray(m.features) ? m.features.map((f) => f?.name) : [];
  if (names.length !== FEATURE_NAMES.length || names.some((n, i) => n !== FEATURE_NAMES[i])) {
    problems.push(`features must be, in order: ${FEATURE_NAMES.join(', ')}`);
  } else {
    for (const f of m.features) {
      if (![f.median, f.center, f.coefficient].every(isNumber) || !isNumber(f.scale) || f.scale <= 0) {
        problems.push(`${f.name} needs a median, center and coefficient, and a positive scale`);
      }
    }
  }

  const t = m.training;
  if (!t || !isNonEmpty(t.dataset) || !isNonEmpty(t.lender) || !/^[A-Z]{3}$/.test(t.currency ?? '')) {
    problems.push('training needs a dataset, a lender and a three-letter currency code');
  } else if (
    ![t.firstLoanYear, t.lastLoanYear, t.finishedLoans].every(isWholePositive) ||
    !Number.isInteger(t.notRepaid) ||
    t.notRepaid > t.finishedLoans
  ) {
    problems.push('training needs loan years and counts');
  }
  const s = m.test;
  const isShare = (n: unknown) => isNumber(n) && (n as number) >= 0 && (n as number) <= 1;
  if (
    !s ||
    !isWholePositive(s.loans) ||
    !Number.isInteger(s.notRepaid) ||
    !isShare(s.rocAuc) ||
    !Array.isArray(s.rocAucInterval) ||
    s.rocAucInterval.length !== 2 ||
    !s.rocAucInterval.every(isShare)
  ) {
    problems.push('test needs loan counts, rocAuc and a two-value rocAucInterval between 0 and 1');
  }
  return problems;
}

// ---- features --------------------------------------------------------------

const DAY_MS = 86_400_000;
const dayNumber = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS;
const total = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const mean = (xs: number[]) => total(xs) / xs.length;
const spread = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export type FeatureValues = Record<ModelFeatureName, number | null>;

// The notebook's cashflow_features(). `rows` must be in date order with file
// order kept within a day (parseStatement does this), and every row needs a
// balance. Money in is a positive amount; everything else counts as money out.
export function cashflowFeatures(rows: Required<SourceRecord>[], asOf: string): FeatureValues {
  const end = dayNumber(asOf);
  const t = rows
    .map((r) => ({ ...r, age: end - dayNumber(r.date) }))
    .filter((r) => r.age >= 1 && r.age <= WINDOW_DAYS);
  const out = Object.fromEntries(FEATURE_NAMES.map((n) => [n, null])) as FeatureValues;
  out.tx_count_180d = t.length;
  if (t.length === 0) {
    return { ...out, history_days_180d: 0, observed_months_180d: 0, inflow_months_180d: 0 };
  }

  const ages = t.map((r) => r.age);
  out.history_days_180d = Math.max(...ages) - Math.min(...ages) + 1;
  const inflow = t.filter((r) => r.amount > 0);
  const outflow = t.filter((r) => r.amount <= 0);
  out.total_inflow_180d = total(inflow.map((r) => r.amount));
  out.total_outflow_180d = total(outflow.map((r) => -r.amount));
  out.net_flow_180d = out.total_inflow_180d - out.total_outflow_180d;

  // Six 30-day periods counting back from the as-of date, empty ones included.
  const period = (age: number) => Math.min(Math.floor((age - 1) / 30), 5);
  const monthlyIn = [0, 0, 0, 0, 0, 0];
  const monthlyOut = [0, 0, 0, 0, 0, 0];
  for (const r of inflow) monthlyIn[period(r.age)]! += r.amount;
  for (const r of outflow) monthlyOut[period(r.age)]! += -r.amount;
  const net = monthlyIn.map((x, i) => x - monthlyOut[i]!);
  out.observed_months_180d = new Set(ages.map(period)).size;
  out.inflow_months_180d = monthlyIn.filter((x) => x > 0).length;
  out.avg_monthly_inflow_180d = mean(monthlyIn);
  out.avg_monthly_outflow_180d = mean(monthlyOut);
  out.avg_monthly_net_180d = mean(net);
  out.std_monthly_net_180d = spread(net);
  out.income_cv_180d = spread(monthlyIn) / (mean(monthlyIn) + 1);

  const balances = t.map((r) => r.balance);
  out.median_tx_balance_180d = median(balances);
  out.min_tx_balance_180d = Math.min(...balances);
  const endOfDay = new Map<string, number>();
  for (const r of t) if (r.age <= 90) endOfDay.set(r.date, r.balance);
  out.median_daily_observed_balance_90d = median([...endOfDay.values()]);
  out.negative_balance_tx_share_180d = balances.filter((b) => b < 0).length / t.length;

  const inflowSizes = inflow.map((r) => r.amount);
  const typicalInflow = median(inflowSizes);
  out.median_inflow_size_180d = typicalInflow;
  const recent = inflow.filter((r) => r.age <= 30).map((r) => r.amount);
  const large = typicalInflow === null ? [] : recent.filter((x) => x > 3 * typicalInflow);
  out.recent_large_inflow_share_30d = total(large) / (total(recent) + 1);
  return out;
}

// The pipeline's imputer, scaler and logistic regression, by hand.
export function scoreFeatures(model: ExperimentalModel, values: FeatureValues): { score: number; features: ModelFeature[] } {
  let logit = model.intercept;
  const features = model.features.map((f) => {
    const value = values[f.name];
    const contribution = f.coefficient * (((value ?? f.median) - f.center) / f.scale);
    logit += contribution;
    return { name: f.name, value, trainingMedian: f.median, contribution };
  });
  return { score: 1 / (1 + Math.exp(-logit)), features };
}

// The as-of date is the day after the statement's last row, as if the loan
// started then, so the newest 30-day period isn't left empty. The model counts
// an empty period as no money moving, so a statement shorter than its window
// would look like a quiet account; it needs transactions in all six periods.
const PERIODS = WINDOW_DAYS / 30;

export function experimentalScore(
  model: ExperimentalModel,
  statement: ParsedStatement,
  { statementSha256, computedAt }: { statementSha256: string; computedAt: string },
): ExperimentalScore {
  const base = { model: model.summary, statementSha256, computedAt };
  if (!statement.hasBalance) return { ...base, status: 'not_scored', reason: 'no_balance' };

  const asOf = new Date((dayNumber(statement.lastDate) + 1) * DAY_MS).toISOString().slice(0, 10);
  const values = cashflowFeatures(statement.rows as Required<SourceRecord>[], asOf);
  const count = values.tx_count_180d ?? 0;
  if (count < model.minimumTransactions) {
    return { ...base, status: 'not_scored', reason: 'too_few_transactions', have: count, need: model.minimumTransactions };
  }
  const periods = values.observed_months_180d ?? 0;
  if (periods < PERIODS) return { ...base, status: 'not_scored', reason: 'too_short', have: periods, need: PERIODS };
  return { ...base, status: 'scored', asOf, ...scoreFeatures(model, values) };
}
