import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ModelFeatureName, SourceRecord } from './contract.ts';
import {
  cashflowFeatures,
  experimentalScore,
  FEATURE_NAMES,
  loadExperimentalModel,
  scoreFeatures,
  validateModelFile,
} from './experimental.ts';
import { canonicalJson } from './seal.ts';
import { parseStatement } from './statement.ts';

const MODEL_URL = new URL('../config/experimental-model.json', import.meta.url);
const modelFile = () => JSON.parse(readFileSync(MODEL_URL, 'utf8'));
const model = loadExperimentalModel();

interface ParityCase {
  name: string;
  asOf: string;
  rows: Required<Pick<SourceRecord, 'date' | 'amount' | 'balance'>>[];
  features: Record<ModelFeatureName, number | null>;
  score: number;
}
const parity = JSON.parse(readFileSync(new URL('./experimental.parity.json', import.meta.url), 'utf8')) as {
  cases: ParityCase[];
};

const close = (actual: number | null, expected: number | null, label: string) => {
  if (expected === null) return assert.equal(actual, null, label);
  assert.ok(actual !== null, label);
  assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${label}: ${actual} vs ${expected}`);
};

const statementCsv = (rows: { date: string; amount: number; balance?: number }[]) =>
  ['Date,Description,Amount,Balance', ...rows.map((r) => `${r.date},X,${r.amount},${r.balance ?? ''}`)].join('\n');
const daily = (from: string, days: number, amount = -10) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(`${from}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), amount, balance: 1000 + amount * (i + 1) };
  });
const score = (csv: string) =>
  experimentalScore(model, parseStatement(csv), { statementSha256: 'f'.repeat(64), computedAt: '2026-10-21T00:00:00Z' });

describe('experimental model', () => {
  it('computes the notebook’s features and score on every parity statement', () => {
    assert.ok(parity.cases.length > 0);
    for (const c of parity.cases) {
      const rows = c.rows.map((r) => ({ ...r, description: '' }));
      const values = cashflowFeatures(rows, c.asOf);
      for (const name of FEATURE_NAMES) close(values[name], c.features[name], `${c.name}: ${name}`);
      close(scoreFeatures(model, values).score, c.score, `${c.name}: score`);
    }
  });

  it('uses the day’s last balance for end-of-day balances, in file order', () => {
    const rows = [
      { date: '2026-10-01', description: '', amount: 100, balance: 100 },
      { date: '2026-10-01', description: '', amount: -90, balance: 10 },
    ];
    assert.equal(cashflowFeatures(rows, '2026-10-02').median_daily_observed_balance_90d, 10);
  });

  it('explains why a statement isn’t scored', () => {
    const noBalance = score(statementCsv(daily('2026-04-01', 200).map(({ balance: _b, ...r }) => r)));
    assert.equal(noBalance.status === 'not_scored' && noBalance.reason, 'no_balance');

    const short = score(statementCsv(daily('2026-07-01', 92)));
    assert.deepEqual(short.status === 'not_scored' && short.reason === 'too_short' && [short.have, short.need], [4, 6]);

    const sparse = score(statementCsv(daily('2026-04-01', 200).filter((_, i) => i === 0 || i === 199)));
    assert.equal(sparse.status === 'not_scored' && sparse.reason, 'too_few_transactions');
  });

  it('scores a six-month statement as of the day after its last row, with every feature', () => {
    const result = score(statementCsv(daily('2026-04-01', 200)));
    assert.equal(result.status, 'scored');
    if (result.status !== 'scored') return;
    assert.equal(result.asOf, '2026-10-18');
    assert.ok(result.score > 0 && result.score < 1);
    assert.deepEqual(
      result.features.map((f) => f.name),
      [...FEATURE_NAMES],
    );
    assert.equal(result.model.sha256, createHash('sha256').update(canonicalJson(modelFile())).digest('hex'));
  });

  it('refuses a model file that doesn’t match the feature builder', () => {
    assert.deepEqual(validateModelFile(modelFile()), []);
    const swapped = modelFile();
    [swapped.features[0], swapped.features[1]] = [swapped.features[1], swapped.features[0]];
    assert.match(validateModelFile(swapped).join(), /features must be, in order/);
    const zeroScale = modelFile();
    zeroScale.features[3].scale = 0;
    assert.match(validateModelFile(zeroScale).join(), /positive scale/);
    assert.match(validateModelFile({ ...modelFile(), windowDays: 90 }).join(), /windowDays must be 180/);
  });
});
