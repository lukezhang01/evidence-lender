import { randomBytes } from 'node:crypto';
import type {
  Applicant,
  Application,
  BlindSpot,
  BorrowerRequest,
  BorrowerView,
  ConfigResponse,
  Decision,
  DecisionRequest,
  DraftEvidence,
  EvidenceItem,
  EvidenceRecord,
  FieldErrors,
  Institution,
  Offer,
  ProductConfig,
  Reviewer,
  SourceRequest,
  Suggestion,
  SuggestionMetrics,
} from './contract.ts';
import type {
  DecisionFixture,
  EvidenceRecordFixture,
  SampleProfile,
  SuggestionFixture,
} from './fixtures.ts';
import { quote } from './pricing.ts';
import { sealItems } from './seal.ts';

export interface StoreData {
  reviewers: Reviewer[];
  currentReviewerId: string;
  applications: Application[];
  evidenceRecords: EvidenceRecordFixture[];
  suggestions: SuggestionFixture[];
  decisions: DecisionFixture[];
  institutions: Institution[];
  sampleApplicant: Applicant;
  sampleProfiles: SampleProfile[];
}

export interface StoreOptions {
  connectionDelayMs: number;
  now?: () => Date;
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
  profileId?: string;
}

interface State {
  applications: Map<string, Application>;
  records: Map<string, EvidenceRecord>;
  drafts: Map<string, Draft>;
  suggestions: Map<string, SuggestionFixture>;
  decisions: Decision[];
}

const MAX_TEXT = 2000;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_TEXT) : '');
const shortId = () => randomBytes(3).toString('hex');

// In-memory state over the fixtures. Resettable for demos; replaced by real
// persistence in build order step 6.
export function createStore(config: ProductConfig, data: StoreData, options: StoreOptions) {
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const money = new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0,
  });

  function load(): State {
    const fixtures = structuredClone({
      applications: data.applications,
      evidenceRecords: data.evidenceRecords,
      suggestions: data.suggestions,
      decisions: data.decisions,
    });
    return {
      applications: new Map(fixtures.applications.map((a) => [a.id, a])),
      records: new Map(fixtures.evidenceRecords.map((r) => [r.id, { ...r, sha256: sealItems(r.items) }])),
      drafts: new Map(),
      suggestions: new Map(fixtures.suggestions.map((s) => [s.applicationId, s])),
      decisions: fixtures.decisions.map(({ amount, ...d }) => ({
        ...d,
        ...(amount !== undefined ? { offer: quote(amount, config.pricing) } : {}),
      })),
    };
  }
  let state = load();

  // ---- reads ---------------------------------------------------------------

  function requireApplication(id: string, { allowDraft = false } = {}): Application {
    const app = state.applications.get(id);
    if (!app || (!allowDraft && app.status === 'draft')) throw new ApiProblem(404, `No application ${id}`);
    return app;
  }

  function requireDraft(id: string): { app: Application; draft: Draft } {
    const app = requireApplication(id, { allowDraft: true });
    if (app.status !== 'draft') throw new ApiProblem(409, `Application ${id} is already submitted`);
    let draft = state.drafts.get(id);
    if (!draft) {
      draft = { items: [], blindSpots: [] };
      state.drafts.set(id, draft);
    }
    return { app, draft };
  }

  function recordFor(app: Application) {
    return app.evidenceRecordId ? state.records.get(app.evidenceRecordId) : undefined;
  }

  function metricsFor(items: EvidenceItem[], offer: Offer): SuggestionMetrics {
    const figure = (name: string) => items.find((i) => i.verified && i.figure?.name === name);
    const pay = figure('monthly_net_pay');
    const leftOver = figure('monthly_left_over');
    return {
      monthlyPayment: offer.monthlyPayment,
      ...(pay?.figure && pay.figure.value > 0 ? { paymentShareOfPay: offer.monthlyPayment / pay.figure.value } : {}),
      ...(leftOver?.figure ? { leftOverAfterPayment: leftOver.figure.value - offer.monthlyPayment } : {}),
      derivedFrom: [pay?.id, leftOver?.id].filter((id): id is string => !!id),
    };
  }

  function getSuggestion(applicationId: string): Suggestion | undefined {
    const app = state.applications.get(applicationId);
    const fixture = state.suggestions.get(applicationId);
    if (!app || app.status === 'draft' || !fixture) return undefined;

    const record = recordFor(app);
    const base = {
      applicationId,
      modelVersion: fixture.modelVersion,
      modelValidatedAt: fixture.modelValidatedAt,
      pricingIllustrative: config.pricing.illustrative,
      whatWouldChange: [] as string[],
    };

    // Uploads never feed the suggestion: with nothing verified at source, there is none.
    if (!record) return { ...base, outcome: 'none', noneReason: 'nothing_submitted', reasons: [] };
    if (!record.items.some((i) => i.verified) || fixture.outcome === 'none') {
      return { ...base, outcome: 'none', noneReason: 'nothing_verified', reasons: [] };
    }
    if (fixture.outcome === 'decline') {
      return { ...base, outcome: 'decline', reasons: fixture.reasons, whatWouldChange: fixture.whatWouldChange };
    }
    const offer = quote(Math.min(app.requestedAmount, config.pricing.starterLimit), config.pricing);
    return {
      ...base,
      outcome: 'approve',
      offer,
      metrics: metricsFor(record.items, offer),
      reasons: fixture.reasons,
    };
  }

  function listDecisions(applicationId: string) {
    return state.decisions
      .filter((d) => d.applicationId === applicationId)
      .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
  }

  function latestDecision(applicationId: string) {
    return listDecisions(applicationId).at(-1);
  }

  // ---- borrower writes -----------------------------------------------------

  function parseApplicant(body: Record<string, unknown>, fields: FieldErrors): Applicant {
    const a = isRecord(body.applicant) ? body.applicant : {};
    const applicant = { legalName: text(a.legalName), email: text(a.email), phone: text(a.phone) };
    if (!applicant.legalName) fields.legalName = 'Enter your full legal name.';
    return applicant;
  }

  function parseRequestedAmount(body: Record<string, unknown>, fields: FieldErrors): number {
    const amount = body.requestedAmount;
    if (typeof amount !== 'number' || !config.borrower.amountOptions.includes(amount)) {
      fields.requestedAmount = 'Choose one of the amounts shown.';
      return 0;
    }
    return amount;
  }

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
      dataStatus: 'not_connected',
      flags: [],
      sourceRequests: [],
      borrowerRequests: [],
    };
    state.applications.set(app.id, app);
    return app;
  }

  async function connect(applicationId: string, body: unknown): Promise<DraftEvidence> {
    const { app, draft } = requireDraft(applicationId);
    const b = isRecord(body) ? body : {};
    const institution = data.institutions.find((i) => i.id === b.institutionId);
    if (!institution) throw new ApiProblem(422, 'Choose a bank from the list', { institutionId: 'Choose a bank.' });
    const profile = data.sampleProfiles.find((p) => p.id === b.profileId) ?? data.sampleProfiles[0];
    if (!profile) throw new ApiProblem(409, 'No sample bank data is configured');

    // Stands in for the data provider reading the account (HANDOFF section 8).
    await new Promise((resolve) => setTimeout(resolve, options.connectionDelayMs));

    const connectedAt = now();
    const connectionRef = `conn-${shortId()}`;
    const idFor = (key: string) => `ev-${app.id}-${key}`;
    const connected: EvidenceItem[] = profile.items.map((t) => ({
      id: idFor(t.key),
      category: t.category,
      statement: t.statement,
      sourceType: t.sourceType,
      sourceRef: t.sourceType === 'derived' ? `calc-${t.key}-${app.id}` : connectionRef,
      sourceDetail: t.sourceDetail,
      retrievedAt: connectedAt,
      verified: true,
      ...(t.derivedFrom ? { derivedFrom: t.derivedFrom.map(idFor) } : {}),
      ...(t.figure ? { figure: { ...t.figure } } : {}),
      records: structuredClone(t.records),
    }));

    // A new connection replaces the previous one; uploads stay.
    draft.items = [...connected, ...draft.items.filter((i) => i.sourceType === 'upload')];
    draft.blindSpots = structuredClone(profile.blindSpots);
    draft.profileId = profile.id;
    app.connection = { institutionName: institution.kind === 'other' ? null : institution.name, connectedAt };
    app.dataStatus = 'bank_connected';
    return { application: app, items: draft.items };
  }

  function addUpload(applicationId: string, body: unknown): DraftEvidence {
    const { app, draft } = requireDraft(applicationId);
    const b = isRecord(body) ? body : {};
    const fileName = text(b.fileName).slice(0, 200);
    if (!fileName) throw new ApiProblem(422, 'Choose a file', { fileName: 'Choose a file to upload.' });

    const n = draft.items.filter((i) => i.sourceType === 'upload').length + 1;
    const contentType = text(b.contentType);
    const kind = contentType === 'application/pdf' ? 'PDF document' : contentType.startsWith('image/') ? 'Image' : 'Document';
    draft.items.push({
      id: `ev-${app.id}-upload-${n}`,
      category: 'capacity',
      statement: `${fileName}, not yet read by a person`,
      sourceType: 'upload',
      sourceRef: `upload-${shortId()}`,
      sourceDetail: kind,
      retrievedAt: now(),
      verified: false,
      records: [],
    });
    if (app.dataStatus === 'not_connected') app.dataStatus = 'uploads_only';
    return { application: app, items: draft.items };
  }

  function submit(applicationId: string, body: unknown): Application {
    const { app, draft } = requireDraft(applicationId);
    const b = isRecord(body) ? body : {};
    const fields: FieldErrors = {};
    const applicant = parseApplicant(b, fields);
    const requestedAmount = parseRequestedAmount(b, fields);
    if (draft.items.length === 0) fields.evidence = 'Connect your bank before you submit.';
    if (Object.keys(fields).length) throw new ApiProblem(422, 'This application isn’t ready to submit', fields);

    const sealedAt = now();
    const record: EvidenceRecord = {
      id: `ER-${app.id}`,
      applicationId: app.id,
      items: draft.items,
      blindSpots: draft.blindSpots.length
        ? draft.blindSpots
        : [{ title: 'Income, bills and balances at the source', note: 'Nothing here could be traced to a bank or employer.' }],
      sealedAt,
      sha256: sealItems(draft.items),
    };
    state.records.set(record.id, record);
    state.drafts.delete(app.id);

    const profile = data.sampleProfiles.find((p) => p.id === draft.profileId);
    state.suggestions.set(
      app.id,
      profile
        ? { applicationId: app.id, ...structuredClone(profile.suggestion) }
        : { applicationId: app.id, outcome: 'none', reasons: [], whatWouldChange: [], modelVersion: '[version]', modelValidatedAt: null },
    );

    const holder = record.items.find((i) => i.verified && i.sourceType === 'bank_api' && i.category === 'identity');
    Object.assign(app, {
      applicant,
      requestedAmount,
      status: record.items.some((i) => i.verified) ? 'ready' : 'unverifiable',
      submittedAt: sealedAt,
      evidenceRecordId: record.id,
      flags: holder ? [{ code: 'bank_connected', evidenceItemId: holder.id }] : [],
      ...(text(b.borrowerNote) ? { borrowerNote: text(b.borrowerNote) } : {}),
    } satisfies Partial<Application>);
    return app;
  }

  function borrowerRequest(applicationId: string, body: unknown): Application {
    const app = requireApplication(applicationId);
    const kind = isRecord(body) ? body.kind : undefined;
    const decision = latestDecision(app.id);
    const allowed: Record<BorrowerRequest['kind'], Decision['outcome']> = {
      accept_offer: 'approved',
      talk_first: 'approved',
      recheck: 'declined',
      human_review: 'declined',
    };
    if (typeof kind !== 'string' || !(kind in allowed)) throw new ApiProblem(422, 'Unknown request');
    const k = kind as BorrowerRequest['kind'];
    if (decision?.outcome !== allowed[k]) throw new ApiProblem(409, 'That isn’t available for this decision');
    if (app.borrowerRequests.some((r) => r.kind === k)) return app;

    const request: BorrowerRequest = { kind: k, requestedAt: now() };
    if (k === 'recheck') request.recheckOn = addMonthsLocal(decision.decidedAt, config.borrower.recheckMonths);
    app.borrowerRequests.push(request);
    return app;
  }

  function addMonthsLocal(iso: string, months: number): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(new Date(iso));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const target = new Date(Date.UTC(part('year'), part('month') - 1 + months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(part('day'), lastDay));
    return target.toISOString().slice(0, 10);
  }

  function borrowerView(applicationId: string): BorrowerView {
    const app = requireApplication(applicationId);
    const decision = latestDecision(app.id);
    const suggestion = getSuggestion(app.id);
    if (!decision) return { application: app, outcome: { kind: 'in_review' } };
    if (decision.outcome === 'approved' && decision.offer) {
      return { application: app, outcome: { kind: 'approved', offer: decision.offer, reasons: suggestion?.reasons ?? [] } };
    }
    const chosen = config.declineReasons.find((r) => r.id === decision.declineReasonId);
    return {
      application: app,
      outcome: chosen
        ? { kind: 'declined', reasons: [chosen.label], whatWouldChange: chosen.whatWouldChange }
        : {
            kind: 'declined',
            reasons: suggestion?.reasons.map((r) => r.text) ?? [],
            whatWouldChange: suggestion?.whatWouldChange ?? [],
          },
    };
  }

  // ---- reviewer writes -----------------------------------------------------

  function decide(applicationId: string, body: unknown): Decision {
    const app = requireApplication(applicationId);
    if (app.status === 'decided') {
      throw new ApiProblem(409, 'This application already has a logged decision. Decisions are append-only.');
    }
    const suggestion = getSuggestion(app.id);
    const record = recordFor(app);
    if (!suggestion || suggestion.outcome === 'none' || !record) {
      throw new ApiProblem(409, 'Nothing here is verified at source, so no decision can be logged. Ask for a source connection first.');
    }

    const b: Partial<DecisionRequest> = isRecord(body) ? body : {};
    const fields: FieldErrors = {};
    const note = text(b.overrideNote);
    const noteMessage = 'Write why you’re overriding the suggestion. It’s saved with the decision.';
    const base = {
      id: `D-${app.id}-${listDecisions(app.id).length + 1}`,
      applicationId: app.id,
      evidenceRecordId: record.id,
      reviewerId: data.currentReviewerId,
      decidedAt: now(),
    };
    let decision: Decision;

    if (b.mode === 'follow') {
      decision =
        suggestion.outcome === 'approve' && suggestion.offer
          ? { ...base, outcome: 'approved', offer: suggestion.offer, followedSuggestion: true }
          : { ...base, outcome: 'declined', applicantReason: suggestion.reasons[0]?.text ?? '', followedSuggestion: true };
    } else if (b.mode === 'adjust') {
      const { min, max } = config.pricing.reviewerAdjustRange;
      const amount = b.amount;
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < min || amount > max) {
        fields.amount = `Enter an amount between ${money.format(min)} and ${money.format(max)}.`;
      } else if (suggestion.outcome === 'approve' && amount === suggestion.offer?.amount) {
        fields.amount = 'That’s the suggested amount. Use “Approve as suggested” instead.';
      }
      if (!note) fields.overrideNote = noteMessage;
      if (Object.keys(fields).length) throw new ApiProblem(422, 'Check the highlighted fields', fields);
      decision = {
        ...base,
        outcome: 'approved',
        offer: quote(amount as number, config.pricing),
        followedSuggestion: false,
        overrideNote: note,
      };
    } else if (b.mode === 'decline') {
      const reason = config.declineReasons.find((r) => r.id === b.declineReasonId);
      const overriding = suggestion.outcome !== 'decline';
      if (!reason) fields.declineReasonId = 'Choose the reason the applicant will see.';
      if (overriding && !note) fields.overrideNote = noteMessage;
      if (Object.keys(fields).length) throw new ApiProblem(422, 'Check the highlighted fields', fields);
      decision = {
        ...base,
        outcome: 'declined',
        applicantReason: reason!.label,
        declineReasonId: reason!.id,
        followedSuggestion: !overriding,
        ...(note ? { overrideNote: note } : {}),
      };
    } else {
      throw new ApiProblem(422, 'mode must be follow, adjust or decline');
    }

    state.decisions.push(decision);
    app.status = 'decided';
    return decision;
  }

  function requestSource(applicationId: string, body: unknown): Application {
    const app = requireApplication(applicationId);
    const kind = isRecord(body) ? body.kind : undefined;
    if (kind !== 'payroll' && kind !== 'bank_or_payroll') throw new ApiProblem(422, 'Unknown source request');
    if (app.status === 'decided') throw new ApiProblem(409, 'This application is already decided');
    if (!app.sourceRequests.some((r) => r.kind === kind)) {
      const request: SourceRequest = { kind, requestedAt: now(), reviewerId: data.currentReviewerId };
      app.sourceRequests.push(request);
    }
    return app;
  }

  function quoteAmount(rawAmount: string | null): Offer {
    const amount = Number(rawAmount);
    const { min, max } = config.pricing.reviewerAdjustRange;
    if (!Number.isInteger(amount) || amount < min || amount > max) {
      throw new ApiProblem(422, `Enter an amount between ${money.format(min)} and ${money.format(max)}.`, {
        amount: `Enter an amount between ${money.format(min)} and ${money.format(max)}.`,
      });
    }
    return quote(amount, config.pricing);
  }

  return {
    getConfig(): ConfigResponse {
      return {
        ...config,
        sampleData: true,
        demo: {
          sampleApplicant: data.sampleApplicant,
          profiles: data.sampleProfiles.map((p) => ({ id: p.id, label: p.label })),
        },
      };
    },
    getCurrentReviewer: () => data.reviewers.find((r) => r.id === data.currentReviewerId),
    listReviewers: () => data.reviewers,
    listInstitutions: () => data.institutions,
    listApplications: () =>
      [...state.applications.values()]
        .filter((a) => a.status !== 'draft')
        .sort((a, b) => Date.parse(b.submittedAt ?? '') - Date.parse(a.submittedAt ?? '')),
    getApplication: (id: string) => {
      const app = state.applications.get(id);
      return app && app.status !== 'draft' ? app : undefined;
    },
    getEvidenceRecord: (id: string) => state.records.get(id),
    getSuggestion,
    listDecisions: (id: string) => (state.applications.has(id) ? listDecisions(id) : undefined),
    borrowerView,
    quoteAmount,
    createApplication,
    connect,
    addUpload,
    submit,
    borrowerRequest,
    decide,
    requestSource,
    reset() {
      state = load();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
