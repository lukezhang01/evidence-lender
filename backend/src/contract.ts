// API contract between the backend and the frontend.
//
// Based on the data model sketch in docs/HANDOFF.md section 7. Fields the sketch
// left out but the screens need are marked "Added". The frontend imports this
// file for types only, so it must not import anything or contain runtime code.

export type EvidenceCategory = 'identity' | 'capacity' | 'willingness' | 'resilience';

// Added: 'bureau', so a credit-bureau lookup (including "no file found") carries
// provenance like every other fact.
export type SourceType = 'bank_api' | 'payroll_api' | 'id_check' | 'bureau' | 'upload' | 'derived';

// Added: structured record values instead of preformatted strings, so the
// frontend formats money in the configured locale and currency.
export type RecordValue =
  | { kind: 'money'; amount: number }
  | { kind: 'outcome'; outcome: 'match' | 'no_match' | 'found' | 'not_found' };

export interface SourceRecord {
  date: string; // ISO 8601: a calendar date (YYYY-MM-DD) or a date-time with offset
  description: string;
  value: RecordValue;
}

export interface EvidenceItem {
  id: string;
  category: EvidenceCategory;
  statement: string; // plain-language fact shown in the UI
  sourceType: SourceType;
  sourceRef: string; // e.g. connection id, vendor check id
  sourceDetail: string; // Added: readable part of the provenance line, e.g. "24 payroll deposits"
  retrievedAt: string; // ISO timestamp (computed-at, for derived facts)
  verified: boolean; // false for uploads, always
  derivedFrom?: string[]; // ids of items a derived fact was computed from
  records: SourceRecord[];
}

// Added: what the evidence can't see. Shown on every review screen.
export interface BlindSpot {
  title: string;
  note: string;
}

export interface EvidenceRecord {
  id: string; // e.g. ER-4821
  applicationId: string;
  items: EvidenceItem[];
  blindSpots: BlindSpot[]; // Added. Not part of the hash, which covers items only.
  sealedAt: string;
  sha256: string; // over the canonical JSON of items
}

export interface Reason {
  direction: 'helps' | 'hurts';
  text: string; // written to be sent to the applicant unchanged
}

export interface Suggestion {
  applicationId: string; // Added
  outcome: 'approve' | 'decline' | 'none'; // 'none' when nothing is verified
  amount?: number;
  termMonths?: number;
  apr?: number;
  reasons: Reason[];
  modelVersion: string;
  modelValidatedAt: string | null; // Added
  pricingIllustrative: boolean; // Added: true while pricing is demo config
}

export interface Decision {
  applicationId: string;
  evidenceRecordId: string;
  outcome: 'approved' | 'declined';
  amount?: number;
  followedSuggestion: boolean;
  overrideNote?: string; // required when followedSuggestion is false
  applicantReason?: string; // required for declines
  reviewerId: string;
  decidedAt: string;
}

export type ApplicationStatus = 'ready' | 'waiting' | 'unverifiable' | 'decided';

// Added: the "data status" shown in the queue.
export type DataStatus = 'bank_connected' | 'payroll_pending' | 'uploads_only';

// Added: header chips. Each one points at the evidence item that supports it,
// so a chip is never a fact without a source.
export type FlagCode = 'bank_connected' | 'no_bureau_file';

export interface ApplicationFlag {
  code: FlagCode;
  evidenceItemId: string;
}

export interface Applicant {
  legalName: string;
  email: string;
  phone: string;
}

export interface Application {
  id: string;
  applicant: Applicant;
  requestedAmount: number;
  status: ApplicationStatus;
  dataStatus: DataStatus; // Added
  submittedAt: string; // Added
  flags: ApplicationFlag[]; // Added
  borrowerNote?: string; // "something looks wrong" text
  evidenceRecordId?: string;
}

// Added: the signed-in reviewer.
export interface Reviewer {
  id: string;
  name: string;
  initials: string;
}

// Added: product and display settings. Pricing is a business decision, so it
// lives in backend/config/product.json, not in code.
export interface ProductConfig {
  brand: { name: string };
  locale: string; // BCP 47, e.g. "en-CA"
  currency: string; // ISO 4217, e.g. "CAD"
  timeZone: string; // IANA, e.g. "America/Toronto"
  borrower: {
    amountOptions: number[];
    defaultAmount: number;
  };
  pricing: {
    illustrative: boolean;
    apr: number; // e.g. 0.249 for 24.9%
    termMonths: number;
    starterLimit: number;
    stepUp: { onTimePayments: number; limit: number };
    reviewerAdjustRange: { min: number; max: number };
  };
}

// GET /api/config
export interface ConfigResponse extends ProductConfig {
  sampleData: boolean; // true while the backend serves fixtures
}

export interface ApiError {
  error: { code: 'not_found' | 'method_not_allowed' | 'internal'; message: string };
}
