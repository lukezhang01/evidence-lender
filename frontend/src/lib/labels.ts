// UI wording for the codes the API returns. Copy lives here; data never does.
import type {
  ApplicationStatus,
  DataStatus,
  EvidenceCategory,
  FigureName,
  FlagCode,
  RecordValue,
  SourceType,
} from '@evidence-lender/backend/contract';

export type Tone = 'ok' | 'warn' | 'neutral';

export const applicationStatus: Record<ApplicationStatus, { label: string; tone: Tone; note?: string }> = {
  draft: { label: 'Not submitted', tone: 'neutral' },
  ready: { label: 'Ready for review', tone: 'ok' },
  waiting: {
    label: 'Waiting on applicant',
    tone: 'neutral',
    note: 'There’s nothing to review until the applicant’s data arrives.',
  },
  unverifiable: {
    label: 'Can’t verify at source',
    tone: 'warn',
    note: 'Every piece of evidence here is an uploaded document, so none of it can be traced to its source. No suggestion is made. Ask the applicant to connect a bank or payroll account.',
  },
  decided: { label: 'Decided', tone: 'neutral' },
};

export const dataStatusLabel: Record<DataStatus, string> = {
  not_connected: 'Nothing connected',
  bank_connected: 'Bank connected',
  payroll_pending: 'Verifying with payroll',
  uploads_only: 'Uploads only',
};

export const flagLabel: Record<FlagCode, { label: string; tone: Tone }> = {
  bank_connected: { label: 'Bank connected', tone: 'ok' },
  no_bureau_file: { label: 'No Canadian bureau file', tone: 'neutral' },
};

export const sourceTypeLabel: Record<SourceType, string> = {
  bank_api: 'Bank connection',
  payroll_api: 'Payroll connection',
  id_check: 'ID check',
  bureau: 'Credit bureau',
  upload: 'Uploaded by applicant',
  derived: 'Derived',
};

// Always shown in this order (docs/HANDOFF.md section 5).
export const categories: { key: EvidenceCategory; title: string; question: string; lastColumn: string }[] = [
  { key: 'identity', title: 'Identity', question: 'Is this person who they say they are?', lastColumn: 'Result' },
  {
    key: 'capacity',
    title: 'Capacity',
    question: 'Is there enough reliable income to cover the payment?',
    lastColumn: 'Amount',
  },
  { key: 'willingness', title: 'Willingness', question: 'When money is tight, do they keep paying?', lastColumn: 'Amount' },
  { key: 'resilience', title: 'Resilience', question: 'What happens after a shock?', lastColumn: 'Balance' },
];

export const outcomeLabel: Record<Extract<RecordValue, { kind: 'outcome' }>['outcome'], string> = {
  match: 'Match',
  no_match: 'No match',
  found: 'File found',
  not_found: 'No file found',
};

// Borrower "Here's what we found" tiles, in display order.
export const figures: { name: FigureName; label: string; kind: 'money' | 'count' }[] = [
  { name: 'monthly_net_pay', label: 'Pay, typical month', kind: 'money' },
  { name: 'monthly_rent', label: 'Rent', kind: 'money' },
  { name: 'monthly_other_bills', label: 'Other regular bills', kind: 'money' },
  { name: 'monthly_left_over', label: 'Left over each month', kind: 'money' },
  { name: 'savings', label: 'Savings', kind: 'money' },
  { name: 'overdrafts_12m', label: 'Overdrafts', kind: 'count' },
];
