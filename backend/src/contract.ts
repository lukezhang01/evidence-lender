// API contract between the backend and the frontend.
//
// Based on the data model sketch in docs/HANDOFF.md section 7. Fields the sketch
// left out but the screens need are marked "Added"; fields reshaped are marked
// "Changed". The frontend imports this file for types only, so it must not
// import anything or contain runtime code.

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

// Added: the number behind a fact, so screens can show and compute with it
// without parsing the statement. `note` is the borrower-facing context line.
export type FigureName =
  | 'monthly_net_pay'
  | 'monthly_rent'
  | 'monthly_other_bills'
  | 'monthly_left_over'
  | 'savings'
  | 'overdrafts_12m';

export interface Figure {
  name: FigureName;
  value: number;
  note: string;
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
  figure?: Figure; // Added
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

// Added: the terms of a loan, priced from config.
export interface Offer {
  amount: number;
  termMonths: number;
  apr: number; // e.g. 0.249 for 24.9%
  monthlyPayment: number;
  totalCostOfBorrowing: number;
  stepUp: { onTimePayments: number; limit: number };
}

// Added: the three numbers on the decision panel, with the facts they came from.
export interface SuggestionMetrics {
  monthlyPayment: number;
  paymentShareOfPay?: number; // 0.049 for 4.9%
  leftOverAfterPayment?: number;
  derivedFrom: string[];
}

export interface Suggestion {
  applicationId: string; // Added
  outcome: 'approve' | 'decline' | 'none'; // 'none' when nothing is verified
  noneReason?: 'nothing_submitted' | 'nothing_verified'; // Added
  offer?: Offer; // Changed: section 7's amount, termMonths and apr, plus payment and cost
  metrics?: SuggestionMetrics; // Added
  reasons: Reason[];
  whatWouldChange: string[]; // Added: shown to declined applicants
  modelVersion: string;
  modelValidatedAt: string | null; // Added
  pricingIllustrative: boolean; // Added: true while pricing is demo config
}

export interface Decision {
  id: string; // Added
  applicationId: string;
  evidenceRecordId: string;
  outcome: 'approved' | 'declined';
  offer?: Offer; // Changed: section 7's amount, as the full terms the applicant was offered
  followedSuggestion: boolean;
  overrideNote?: string; // required when followedSuggestion is false
  applicantReason?: string; // required for declines
  declineReasonId?: string; // Added: which configured reason was chosen
  reviewerId: string;
  decidedAt: string;
}

// Added: POST /api/applications/:id/decisions
export interface DecisionRequest {
  mode: 'follow' | 'adjust' | 'decline';
  amount?: number; // adjust
  declineReasonId?: string; // decline
  overrideNote?: string; // required unless following the suggestion
}

export type ApplicationStatus = 'draft' | 'ready' | 'waiting' | 'unverifiable' | 'decided';

// Added: the "data status" shown in the queue.
export type DataStatus = 'not_connected' | 'bank_connected' | 'payroll_pending' | 'uploads_only';

// Added: header chips. Each one points at the evidence item that supports it,
// so a chip is never a fact without a source.
export type FlagCode = 'bank_connected' | 'no_bureau_file';

export interface ApplicationFlag {
  code: FlagCode;
  evidenceItemId: string;
}

// Added: a reviewer asking the applicant for source-verified evidence.
export interface SourceRequest {
  kind: 'payroll' | 'bank_or_payroll';
  requestedAt: string;
  reviewerId: string;
}

// Added: what the applicant asked for after seeing the outcome.
export interface BorrowerRequest {
  kind: 'accept_offer' | 'talk_first' | 'recheck' | 'human_review';
  requestedAt: string;
  recheckOn?: string; // YYYY-MM-DD, for 'recheck'
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
  submittedAt?: string; // Added; absent while a draft
  connection?: { institutionName: string | null; connectedAt: string }; // Added
  flags: ApplicationFlag[]; // Added
  sourceRequests: SourceRequest[]; // Added
  borrowerRequests: BorrowerRequest[]; // Added
  borrowerNote?: string; // "something looks wrong" text
  evidenceRecordId?: string;
}

// Added: the signed-in reviewer.
export interface Reviewer {
  id: string;
  name: string;
  initials: string;
}

// Added: banks the data provider can connect to. Sample list for now.
export interface Institution {
  id: string;
  name: string;
  kind: 'bank' | 'other'; // 'other' is the catch-all "another bank or credit union"
}

// Added: evidence a borrower has gathered but not yet submitted.
export interface DraftEvidence {
  application: Application;
  items: EvidenceItem[];
}

// Added: what the borrower sees after submitting.
export type BorrowerOutcome =
  | { kind: 'in_review' }
  | { kind: 'approved'; offer: Offer; reasons: Reason[] }
  | { kind: 'declined'; reasons: string[]; whatWouldChange: string[] };

export interface BorrowerView {
  application: Application;
  outcome: BorrowerOutcome;
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
    historyMonths: number; // how far back the bank connection reads
    recheckMonths: number; // opt-in re-check after a decline
  };
  pricing: {
    illustrative: boolean;
    apr: number;
    termMonths: number;
    starterLimit: number;
    stepUp: { onTimePayments: number; limit: number };
    reviewerAdjustRange: { min: number; max: number };
  };
  declineReasons: { id: string; label: string; whatWouldChange: string[] }[];
}

export interface SampleProfileSummary {
  id: string;
  label: string;
}

// GET /api/config
export interface ConfigResponse extends ProductConfig {
  sampleData: boolean; // true while the backend serves fixtures
  demo: { sampleApplicant: Applicant; profiles: SampleProfileSummary[] } | null;
}

export type FieldErrors = Partial<Record<string, string>>;

export interface ApiError {
  error: {
    code: 'not_found' | 'method_not_allowed' | 'invalid' | 'conflict' | 'internal';
    message: string;
    fields?: FieldErrors;
  };
}
