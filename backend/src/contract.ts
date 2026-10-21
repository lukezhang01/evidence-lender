// API contract between the backend and the frontend.
//
// Based on the data model sketch in docs/HANDOFF.md section 7, narrowed to the
// current scope: the only evidence is a bank statement the applicant uploads as
// a CSV. Uploads are never verified (rule 2), so no suggestion is made and a
// person decides every application (rule 5). Fields the sketch left out are
// marked "Added"; fields reshaped are marked "Changed". The frontend imports
// this file for types only, so it must not import anything or contain runtime code.

export type EvidenceCategory = 'identity' | 'capacity' | 'willingness' | 'resilience';

// Only uploads are in scope. Source connections (bank, payroll, ID check) add
// their types here when they come back into scope.
export type SourceType = 'upload';

// Changed: one row of the uploaded statement, as parsed.
export interface SourceRecord {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // money in is positive, money out negative
  balance?: number; // when the file has a Balance column
}

// Added: the number behind a fact, so screens can show it without parsing the
// statement text. `note` is the short context line under a borrower tile.
export type FigureName =
  | 'monthly_money_in'
  | 'monthly_left_over'
  | 'monthly_rent'
  | 'overdraft_fees'
  | 'lowest_balance'
  | 'ending_balance';

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
  sourceRef: string; // the upload id
  sourceDetail: string; // Added: readable part of the provenance line, e.g. "statement.csv: 31 deposits"
  retrievedAt: string; // ISO timestamp of the upload
  verified: boolean; // false for uploads, always
  figure?: Figure; // Added
  records: SourceRecord[]; // the statement rows the fact rests on
}

// Added: what the evidence can't see. Shown on every review screen.
export interface BlindSpot {
  title: string;
  note: string;
}

// Added: the experimental score from the course notebook's cash-flow model
// (backend/src/experimental.ts). Reviewers only: nothing the applicant sees
// carries it. It isn't a suggestion: it proposes no outcome, amount or reasons,
// and the reviewer still decides and writes why (rules 2 and 5).
export type ModelFeatureName =
  | 'tx_count_180d'
  | 'history_days_180d'
  | 'observed_months_180d'
  | 'total_inflow_180d'
  | 'total_outflow_180d'
  | 'net_flow_180d'
  | 'avg_monthly_inflow_180d'
  | 'avg_monthly_outflow_180d'
  | 'avg_monthly_net_180d'
  | 'std_monthly_net_180d'
  | 'income_cv_180d'
  | 'inflow_months_180d'
  | 'median_tx_balance_180d'
  | 'min_tx_balance_180d'
  | 'median_daily_observed_balance_90d'
  | 'recent_large_inflow_share_30d'
  | 'negative_balance_tx_share_180d'
  | 'median_inflow_size_180d';

export interface ModelFeature {
  name: ModelFeatureName;
  value: number | null; // null when the statement can't give it; the model then uses the training median
  trainingMedian: number; // in the training data's currency for money features
  contribution: number; // how far this feature moved the score's log-odds from a typical training loan; positive raises it
}

// What the review screen says about the model next to its score.
export interface ModelSummary {
  id: string;
  sha256: string; // over the canonical JSON of the model file
  name: string;
  purpose: string;
  notebook: string;
  windowDays: number;
  training: {
    dataset: string;
    lender: string; // e.g. "a Czech bank"
    currency: string; // ISO 4217
    firstLoanYear: number;
    lastLoanYear: number;
    finishedLoans: number;
    notRepaid: number;
  };
  test: {
    loans: number;
    notRepaid: number;
    rocAuc: number; // how often a loan that wasn't repaid scored above one that was
    rocAucInterval: [number, number]; // 95% bootstrap interval
  };
}

interface ScoreBase {
  model: ModelSummary;
  statementSha256: string; // the uploaded file it was computed from
  computedAt: string; // when the record was sealed
}

export type ExperimentalScore =
  | (ScoreBase & { status: 'scored'; asOf: string; score: number; features: ModelFeature[] })
  | (ScoreBase & { status: 'not_scored'; reason: 'no_balance' })
  | (ScoreBase & { status: 'not_scored'; reason: 'too_short' | 'too_few_transactions'; have: number; need: number });

export interface EvidenceRecord {
  id: string; // e.g. ER-4821
  applicationId: string;
  items: EvidenceItem[];
  blindSpots: BlindSpot[]; // Added. Not part of the hash, which covers items only.
  experimentalScore: ExperimentalScore; // Added. Not part of the hash either; it names the file and model it came from.
  sealedAt: string;
  sha256: string; // over the canonical JSON of items
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

export interface Decision {
  id: string; // Added
  applicationId: string;
  evidenceRecordId: string;
  outcome: 'approved' | 'declined';
  offer?: Offer; // Changed: section 7's amount, as the full terms the applicant was offered
  followedSuggestion: boolean; // always false while no suggestion is made
  overrideNote?: string; // the reviewer's written reason; required while followedSuggestion is false
  applicantReason?: string; // required for declines
  declineReasonId?: string; // Added: which configured reason was chosen
  reviewerId: string;
  decidedAt: string;
}

// Added: POST /api/applications/:id/decisions
export interface DecisionRequest {
  outcome: 'approved' | 'declined';
  amount?: number; // approvals
  declineReasonId?: string; // declines
  note: string; // always required
}

export type ApplicationStatus = 'draft' | 'ready' | 'decided';

// Added: what the applicant uploaded, so screens can describe it.
export interface StatementSummary {
  fileName: string;
  fileSha256: string; // hash of the file exactly as uploaded
  transactionCount: number;
  firstDate: string; // YYYY-MM-DD
  lastDate: string; // YYYY-MM-DD
  hasBalance: boolean;
  uploadedAt: string;
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
  submittedAt?: string; // Added; absent while a draft
  statement?: StatementSummary; // Added
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

// Added: POST /api/applications/:id/statement
export interface StatementUpload {
  fileName: string;
  csv: string;
}

// Added: facts read from an uploaded statement, before the applicant submits.
export interface DraftEvidence {
  application: Application;
  items: EvidenceItem[];
  blindSpots: BlindSpot[];
}

// Added: what the borrower sees after submitting.
export type BorrowerOutcome =
  | { kind: 'in_review' }
  | { kind: 'approved'; offer: Offer }
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
    minimumStatementMonths: number; // how much history an upload must cover
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

// GET /api/config
export type ConfigResponse = ProductConfig;

export type FieldErrors = Partial<Record<string, string>>;

export interface ApiError {
  error: {
    code: 'not_found' | 'method_not_allowed' | 'invalid' | 'conflict' | 'internal';
    message: string;
    fields?: FieldErrors;
  };
}
