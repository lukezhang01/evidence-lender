// UI wording for the codes the API returns. Copy lives here; data never does.
import type { ApplicationStatus, EvidenceCategory, FigureName, SourceType } from '@evidence-lender/backend/contract';

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
