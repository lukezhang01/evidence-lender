// UI wording for the codes the API returns. Copy lives here; data never does.
import type {
  ApplicationStatus,
  EvidenceCategory,
  ExperimentalScore,
  FigureName,
  ModelFeatureName,
  SourceType,
} from '@evidence-lender/backend/contract';

export type Tone = 'ok' | 'warn' | 'neutral';

export const applicationStatus: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Not submitted', tone: 'neutral' },
  ready: { label: 'Ready for review', tone: 'ok' },
  decided: { label: 'Decided', tone: 'neutral' },
};

export const sourceTypeLabel: Record<SourceType, string> = {
  upload: 'Uploaded by applicant',
};

// Always shown in this order (docs/HANDOFF.md section 5).
export const categories: { key: EvidenceCategory; title: string; question: string }[] = [
  { key: 'identity', title: 'Identity', question: 'Is this person who they say they are?' },
  { key: 'capacity', title: 'Capacity', question: 'Is there enough reliable income to cover the payment?' },
  { key: 'willingness', title: 'Willingness', question: 'When money is tight, do they keep paying?' },
  { key: 'resilience', title: 'Resilience', question: 'What happens after a shock?' },
];

// Borrower "Here's what we found" tiles, in display order.
export const figures: { name: FigureName; label: string; kind: 'money' | 'count' }[] = [
  { name: 'monthly_money_in', label: 'Money in, typical month', kind: 'money' },
  { name: 'monthly_left_over', label: 'Left over each month', kind: 'money' },
  { name: 'monthly_rent', label: 'Rent', kind: 'money' },
  { name: 'overdraft_fees', label: 'Overdraft fees', kind: 'count' },
  { name: 'lowest_balance', label: 'Lowest balance', kind: 'money' },
  { name: 'ending_balance', label: 'Balance at the end', kind: 'money' },
];

// ---- experimental score (reviewers only) ----------------------------------

export const experimentalSourceLabel = 'Experimental model';

export type FeatureKind = 'money' | 'count' | 'days' | 'share' | 'ratio';

// The model's features, as the review screen names them.
export const modelFeatures: Record<ModelFeatureName, { label: string; kind: FeatureKind }> = {
  tx_count_180d: { label: 'Transactions in the 180 days', kind: 'count' },
  history_days_180d: { label: 'Days from first to last transaction', kind: 'days' },
  observed_months_180d: { label: '30-day periods with any transactions', kind: 'count' },
  total_inflow_180d: { label: 'Money in over the 180 days', kind: 'money' },
  total_outflow_180d: { label: 'Money out over the 180 days', kind: 'money' },
  net_flow_180d: { label: 'Money in minus money out over the 180 days', kind: 'money' },
  avg_monthly_inflow_180d: { label: 'Money in per 30 days', kind: 'money' },
  avg_monthly_outflow_180d: { label: 'Money out per 30 days', kind: 'money' },
  avg_monthly_net_180d: { label: 'Left over per 30 days', kind: 'money' },
  std_monthly_net_180d: { label: 'How much the left-over changes from one 30 days to the next', kind: 'money' },
  income_cv_180d: { label: 'How uneven money in is (0 means the same every 30 days)', kind: 'ratio' },
  inflow_months_180d: { label: '30-day periods with money in', kind: 'count' },
  median_tx_balance_180d: { label: 'Typical balance after a transaction', kind: 'money' },
  min_tx_balance_180d: { label: 'Lowest balance', kind: 'money' },
  median_daily_observed_balance_90d: { label: 'Typical end-of-day balance, last 90 days', kind: 'money' },
  recent_large_inflow_share_30d: { label: 'Money in over the last 30 days from unusually large deposits', kind: 'share' },
  negative_balance_tx_share_180d: { label: 'Transactions that left the balance below zero', kind: 'share' },
  median_inflow_size_180d: { label: 'Typical deposit', kind: 'money' },
};

type NotScoredReason = Extract<ExperimentalScore, { status: 'not_scored' }>['reason'];

export const notScoredReason: Record<NotScoredReason, (have: number, need: number) => string> = {
  no_balance: () => 'The file has no Balance column, and the model needs the balance after every transaction.',
  too_short: (have, need) =>
    `The model needs transactions in each of the ${need} 30-day periods before the statement ends. This statement has them in ${have}.`,
  too_few_transactions: (have, need) =>
    `The model needs at least ${need} transactions in the 180 days before the statement ends. This statement has ${have}.`,
};
