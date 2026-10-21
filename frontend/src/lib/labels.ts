// UI wording for the codes the API returns. Copy lives here; data never does.
import type {
  ApplicationStatus,
  DataStatus,
  FlagCode,
  SourceType,
} from '@evidence-lender/backend/contract';

export type Tone = 'ok' | 'warn' | 'neutral';

export const applicationStatus: Record<ApplicationStatus, { label: string; tone: Tone; note?: string }> = {
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
  decided: {
    label: 'Decided',
    tone: 'neutral',
    note: 'A decision has been logged. The decision and its evidence record are locked.',
  },
};

export const dataStatusLabel: Record<DataStatus, string> = {
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
