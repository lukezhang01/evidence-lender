import { createHash } from 'node:crypto';
import type {
  Applicant,
  Application,
  BlindSpot,
  BorrowerView,
  ConfigResponse,
  Decision,
  DecisionRequest,
  DraftEvidence,
  EvidenceItem,
  EvidenceRecord,
  FieldErrors,
  Offer,
  ProductConfig,
  Reviewer,
  StatementSummary,
} from './contract.ts';
import { type ExperimentalModel, experimentalScore, loadExperimentalModel } from './experimental.ts';
import type { ApplicationSeed, DecisionFixture, SampleStatement } from './fixtures.ts';
import { quote } from './pricing.ts';
import { sealItems } from './seal.ts';
import { coversMonths, type ParsedStatement, parseStatement, StatementError, statementFacts } from './statement.ts';

export interface StoreData {
  reviewers: Reviewer[];
  currentReviewerId: string;
  sampleStatements: SampleStatement[];
  applicationSeeds: ApplicationSeed[];
  decisions: DecisionFixture[];
}

export interface StoreOptions {
  now?: () => Date;
  model?: ExperimentalModel; // defaults to config/experimental-model.json
}

// Thrown by store operations; the HTTP layer turns it into an error response.
export class ApiProblem extends Error {
  status: 400 | 404 | 409 | 422;
  code: 'invalid' | 'not_found' | 'conflict';
  fields?: FieldErrors;

  constructor(status: ApiProblem['status'], message: string, fields?: FieldErrors) {
    super(message);
    this.status = status;
    this.code = status === 404 ? 'not_found' : status === 409 ? 'conflict' : 'invalid';
    this.fields = fields;
  }
}

interface Draft {
  items: EvidenceItem[];
  blindSpots: BlindSpot[];
  statement: ParsedStatement; // kept for the experimental score, computed when the record is sealed
}

interface State {
  applications: Map<string, Application>;
  records: Map<string, EvidenceRecord>;
  drafts: Map<string, Draft>;
  decisions: Decision[];
}

const MAX_TEXT = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// In-memory state over the fixtures, reset on restart (and by tests). Replaced
// by real persistence later.
export function createStore(config: ProductConfig, data: StoreData, options: StoreOptions = {}) {
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const model = options.model ?? loadExperimentalModel();
  const money = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  });
  const calendarDay = new Intl.DateTimeFormat(config.locale, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const factFormat = {
    money: (n: number) => money.format(n),
    day: (d: string) => calendarDay.format(new Date(`${d}T00:00:00Z`)),
  };

  // Reads one statement into facts, or throws a message for the applicant.
  function readStatement(applicationId: string, fileName: string, csv: string, uploadedAt: string) {
    const statement = parseStatement(csv);
    const months = config.borrower.minimumStatementMonths;
    if (!coversMonths(statement, months)) {
      throw new StatementError(
        `This statement runs from ${factFormat.day(statement.firstDate)} to ${factFormat.day(statement.lastDate)}. Upload at least ${months} months of transactions.`,
      );
    }
    const fileSha256 = sha256(csv);
    const { items, blindSpots } = statementFacts(
      { statement, fileName, uploadRef: `upload-${fileSha256.slice(0, 8)}`, uploadedAt, idPrefix: `ev-${applicationId}` },
      factFormat,
    );
    const summary: StatementSummary = {
      fileName,
      fileSha256,
      transactionCount: statement.rows.length,
      firstDate: statement.firstDate,
      lastDate: statement.lastDate,
      hasBalance: statement.hasBalance,
      uploadedAt,
    };
    return { items, blindSpots, summary, statement };
  }

  // Shown to the reviewer, and to the applicant once submitted.
  const scoreFor = (statement: ParsedStatement, summary: StatementSummary, sealedAt: string) =>
    experimentalScore(model, statement, { statementSha256: summary.fileSha256, computedAt: sealedAt });

  function load(): State {
    const state: State = { applications: new Map(), records: new Map(), drafts: new Map(), decisions: [] };
    const decided = new Set(data.decisions.map((d) => d.applicationId));
    for (const seed of data.applicationSeeds) {
      const sample = data.sampleStatements.find((s) => s.id === seed.statementId);
      if (!sample) throw new Error(`Seed ${seed.id} names an unknown sample statement ${seed.statementId}`);
      const { items, blindSpots, summary, statement } = readStatement(seed.id, sample.fileName, sample.csv, seed.uploadedAt);
      const record: EvidenceRecord = {
        id: `ER-${seed.id}`,
        applicationId: seed.id,
        items,
        blindSpots,
        experimentalScore: scoreFor(statement, summary, seed.submittedAt),
        sealedAt: seed.submittedAt,
        sha256: sealItems(items),
      };
      state.records.set(record.id, record);
      state.applications.set(seed.id, {
        id: seed.id,
        applicant: { ...seed.applicant },
        requestedAmount: seed.requestedAmount,
        status: decided.has(seed.id) ? 'decided' : 'ready',
        submittedAt: seed.submittedAt,
        statement: summary,
        evidenceRecordId: record.id,
      });
    }
    state.decisions = data.decisions.map(({ amount, ...d }) => ({
      ...structuredClone(d),
      ...(amount !== undefined ? { offer: quote(amount, config.pricing) } : {}),
    }));
    return state;
  }
  let state = load();

  // ---- helpers ---------------------------------------------------------------

  function requireApplication(id: string, { allowDraft = false } = {}): Application {
    const app = state.applications.get(id);
    if (!app || (!allowDraft && app.status === 'draft')) throw new ApiProblem(404, `No application ${id}`);
    return app;
  }

  function requireDraft(id: string): Application {
    const app = requireApplication(id, { allowDraft: true });
    if (app.status !== 'draft') throw new ApiProblem(409, `Application ${id} is already submitted`);
    return app;
  }

  function listDecisions(applicationId: string) {
    return state.decisions
      .filter((d) => d.applicationId === applicationId)
      .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
  }

  function parseApplicant(body: Record<string, unknown>, fields: FieldErrors): Applicant {
    const a = isRecord(body.applicant) ? body.applicant : {};
    const applicant = { legalName: text(a.legalName), email: text(a.email) };
    if (!applicant.legalName) fields.legalName = 'Enter your full legal name.';
    if (!EMAIL.test(applicant.email)) fields.email = 'Enter your email address, like name@example.com.';
    return applicant;
  }

  const inRange = (amount: unknown): amount is number => {
    const { min, max } = config.pricing.amountRange;
    return typeof amount === 'number' && Number.isInteger(amount) && amount >= min && amount <= max;
  };

  const rangeMessage = () => {
    const { min, max } = config.pricing.amountRange;
    return `Enter a whole amount from ${money.format(min)} to ${money.format(max)}.`;
  };

  function parseRequestedAmount(body: Record<string, unknown>, fields: FieldErrors): number {
    if (!inRange(body.requestedAmount)) {
      fields.requestedAmount = rangeMessage();
      return 0;
    }
    return body.requestedAmount;
  }

  // ---- borrower --------------------------------------------------------------

  function createApplication(body: unknown): Application {
    const b = isRecord(body) ? body : {};
    const fields: FieldErrors = {};
    const applicant = parseApplicant(b, fields);
    const requestedAmount = parseRequestedAmount(b, fields);
    if (Object.keys(fields).length) throw new ApiProblem(422, 'Check the highlighted fields', fields);

    const nextId = Math.max(0, ...[...state.applications.keys()].map(Number).filter(Number.isFinite)) + 1;
    const app: Application = {
      id: String(nextId),
      applicant,
      requestedAmount,
      status: 'draft',
    };
    state.applications.set(app.id, app);
    return app;
  }

  // A new upload replaces the previous one.
  function uploadStatement(applicationId: string, body: unknown): DraftEvidence {
    const app = requireDraft(applicationId);
    const b = isRecord(body) ? body : {};
    const fileName = text(b.fileName).slice(0, 200) || 'statement.csv';
    const csv = typeof b.csv === 'string' ? b.csv : '';
    if (!csv.trim()) throw new ApiProblem(422, 'Choose a CSV file to upload.', { statement: 'Choose a CSV file to upload.' });

    let read;
    try {
      read = readStatement(app.id, fileName, csv, now());
    } catch (err) {
      if (err instanceof StatementError) throw new ApiProblem(422, err.message, { statement: err.message });
      throw err;
    }
    state.drafts.set(app.id, { items: read.items, blindSpots: read.blindSpots, statement: read.statement });
    app.statement = read.summary;
    return { application: app, items: read.items, blindSpots: read.blindSpots };
  }

  function submit(applicationId: string, body: unknown): Application {
    const app = requireDraft(applicationId);
    const draft = state.drafts.get(app.id);
    const b = isRecord(body) ? body : {};
    const fields: FieldErrors = {};
    const applicant = parseApplicant(b, fields);
    const requestedAmount = parseRequestedAmount(b, fields);
    if (!draft || !app.statement) fields.statement = 'Upload your bank statement before you submit.';
    if (Object.keys(fields).length || !draft || !app.statement) {
      throw new ApiProblem(422, 'This application isn’t ready to submit', fields);
    }

    const sealedAt = now();
    const record: EvidenceRecord = {
      id: `ER-${app.id}`,
      applicationId: app.id,
      items: draft.items,
      blindSpots: draft.blindSpots,
      experimentalScore: scoreFor(draft.statement, app.statement, sealedAt),
      sealedAt,
      sha256: sealItems(draft.items),
    };
    state.records.set(record.id, record);
    state.drafts.delete(app.id);
    Object.assign(app, {
      applicant,
      requestedAmount,
      status: 'ready',
      submittedAt: sealedAt,
      evidenceRecordId: record.id,
    } satisfies Partial<Application>);
    return app;
  }

  function borrowerView(applicationId: string): BorrowerView {
    const app = requireApplication(applicationId);
    const record = app.evidenceRecordId ? state.records.get(app.evidenceRecordId) : undefined;
    if (!record) throw new Error(`Application ${app.id} has no sealed evidence record`);
    const base = { application: app, score: record.experimentalScore };
    const decision = listDecisions(app.id).at(-1);
    if (!decision) return { ...base, outcome: { kind: 'in_review' } };
    if (decision.outcome === 'approved' && decision.offer) {
      return { ...base, outcome: { kind: 'approved', offer: decision.offer } };
    }
    const reason = config.declineReasons.find((r) => r.id === decision.declineReasonId);
    return {
      ...base,
      outcome: {
        kind: 'declined',
        reasons: [reason?.label ?? decision.applicantReason ?? ''].filter(Boolean),
        whatWouldChange: reason?.whatWouldChange ?? [],
      },
    };
  }

  // ---- reviewer --------------------------------------------------------------

  // Uploads never feed a suggestion (rule 2), so a person makes every decision
  // and always writes why (rule 5).
  function decide(applicationId: string, body: unknown): Decision {
    const app = requireApplication(applicationId);
    if (app.status === 'decided') {
      throw new ApiProblem(409, 'This application already has a logged decision. Decisions are append-only.');
    }
    const record = app.evidenceRecordId ? state.records.get(app.evidenceRecordId) : undefined;
    if (!record) throw new ApiProblem(409, 'There’s no sealed evidence record to decide on.');

    const b: Partial<DecisionRequest> = isRecord(body) ? body : {};
    const fields: FieldErrors = {};
    const note = text(b.note);
    if (!note) fields.note = 'Write why you’re deciding this way. It’s saved with the decision.';

    let terms: Pick<Decision, 'outcome' | 'offer' | 'applicantReason' | 'declineReasonId'>;
    if (b.outcome === 'approved') {
      const amount = b.amount;
      if (!inRange(amount)) fields.amount = rangeMessage();
      terms = { outcome: 'approved', offer: inRange(amount) ? quote(amount, config.pricing) : undefined };
    } else if (b.outcome === 'declined') {
      const reason = config.declineReasons.find((r) => r.id === b.declineReasonId);
      if (!reason) fields.declineReasonId = 'Choose the reason the applicant will see.';
      terms = { outcome: 'declined', applicantReason: reason?.label, declineReasonId: reason?.id };
    } else {
      throw new ApiProblem(422, 'outcome must be approved or declined');
    }
    if (Object.keys(fields).length) throw new ApiProblem(422, 'Check the highlighted fields', fields);

    const decision: Decision = {
      id: `D-${app.id}-${listDecisions(app.id).length + 1}`,
      applicationId: app.id,
      evidenceRecordId: record.id,
      ...terms,
      followedSuggestion: false,
      overrideNote: note,
      reviewerId: data.currentReviewerId,
      decidedAt: now(),
    };
    state.decisions.push(decision);
    app.status = 'decided';
    return decision;
  }

  function quoteAmount(rawAmount: string | null): Offer {
    const amount = Number(rawAmount);
    if (!inRange(amount)) throw new ApiProblem(422, rangeMessage(), { amount: rangeMessage() });
    return quote(amount, config.pricing);
  }

  return {
    getConfig: (): ConfigResponse => config,
    getCurrentReviewer: () => data.reviewers.find((r) => r.id === data.currentReviewerId),
    listReviewers: () => data.reviewers,
    listApplications: () =>
      [...state.applications.values()]
        .filter((a) => a.status !== 'draft')
        .sort((a, b) => Date.parse(b.submittedAt ?? '') - Date.parse(a.submittedAt ?? '')),
    getApplication: (id: string) => {
      const app = state.applications.get(id);
      return app && app.status !== 'draft' ? app : undefined;
    },
    getEvidenceRecord: (id: string) => state.records.get(id),
    listDecisions: (id: string) => (state.applications.has(id) ? listDecisions(id) : undefined),
    borrowerView,
    quoteAmount,
    createApplication,
    uploadStatement,
    submit,
    decide,
    reset() {
      state = load();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
