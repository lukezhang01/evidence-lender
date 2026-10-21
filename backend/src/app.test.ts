import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createRequestHandler } from './app.ts';
import { loadProductConfig } from './config.ts';
import type {
  ApiError,
  Application,
  BorrowerView,
  ConfigResponse,
  Decision,
  DraftEvidence,
  EvidenceRecord,
  Offer,
  Suggestion,
} from './contract.ts';
import * as fixtures from './fixtures.ts';
import { quote } from './pricing.ts';
import { sealItems } from './seal.ts';
import { createStore } from './store.ts';

const config = loadProductConfig();
const NOW = '2026-10-21T14:00:00.000Z';
const options = { connectionDelayMs: 0, now: () => new Date(NOW) };

describe('pricing', () => {
  it('matches the prototype’s level-payment formula', () => {
    const offer = quote(3000, config.pricing);
    const r = config.pricing.apr / 12;
    const expected = Math.round(((3000 * r) / (1 - (1 + r) ** -config.pricing.termMonths)) * 100) / 100;
    assert.equal(offer.monthlyPayment, expected);
    assert.equal(offer.totalCostOfBorrowing, Math.round((expected * config.pricing.termMonths - 3000) * 100) / 100);
  });
});

describe('store', () => {
  it('prices an approval from config, capped at the starter limit, with metrics from facts', () => {
    const s = createStore(config, fixtures, options).getSuggestion('4821');
    assert.equal(s?.outcome, 'approve');
    assert.deepEqual(s?.offer, quote(Math.min(4000, config.pricing.starterLimit), config.pricing));
    assert.equal(s?.metrics?.paymentShareOfPay, s!.offer!.monthlyPayment / 4120);
    assert.equal(s?.metrics?.leftOverAfterPayment, 820 - s!.offer!.monthlyPayment);
    assert.deepEqual(s?.metrics?.derivedFrom, ['ev-4821-pay', 'ev-4821-leftover']);
  });

  it('makes no suggestion when the only evidence is uploads, whatever the model said', () => {
    const tampered = {
      ...fixtures,
      suggestions: fixtures.suggestions.map((s) =>
        s.applicationId === '4815'
          ? { ...s, outcome: 'approve' as const, reasons: [{ direction: 'helps' as const, text: 'x' }] }
          : s,
      ),
    };
    const s = createStore(config, tampered, options).getSuggestion('4815');
    assert.equal(s?.outcome, 'none');
    assert.equal(s?.noneReason, 'nothing_verified');
    assert.equal(s?.offer, undefined);
    assert.deepEqual(s?.reasons, []);
  });
});

describe('HTTP API', () => {
  let server: Server;
  let base: string;
  const store = createStore(config, fixtures, options);

  before(async () => {
    server = createServer(createRequestHandler(store));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  beforeEach(() => store.reset());

  const call = async <T>(path: string, init?: { method?: string; body?: unknown }) => {
    const res = await fetch(`${base}${path}`, {
      method: init?.method ?? (init?.body !== undefined ? 'POST' : 'GET'),
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    return { status: res.status, body: (await res.json()) as T };
  };
  const post = <T>(path: string, body: unknown) => call<T>(path, { body });

  async function submitSample(profileId: string): Promise<Application> {
    const created = await post<Application>('/api/applications', {
      applicant: fixtures.sampleApplicant,
      requestedAmount: 4000,
    });
    assert.equal(created.status, 201);
    const connected = await post<DraftEvidence>(`/api/applications/${created.body.id}/connections`, {
      institutionId: 'rbc',
      profileId,
    });
    assert.equal(connected.status, 201);
    const submitted = await post<Application>(`/api/applications/${created.body.id}/submit`, {
      applicant: fixtures.sampleApplicant,
      requestedAmount: 4000,
      borrowerNote: 'March was short because of unpaid leave.',
    });
    assert.equal(submitted.status, 200);
    return submitted.body;
  }

  it('serves config with the sample-data flag and demo prefill', async () => {
    const { body } = await call<ConfigResponse>('/api/config');
    assert.equal(body.sampleData, true);
    assert.deepEqual(body.borrower, config.borrower);
    assert.deepEqual(body.demo?.sampleApplicant, fixtures.sampleApplicant);
  });

  it('lists submitted applications newest first, never drafts', async () => {
    const draft = await post<Application>('/api/applications', { applicant: { legalName: 'A' }, requestedAmount: 1000 });
    const { body } = await call<Application[]>('/api/applications');
    const times = body.map((a) => Date.parse(a.submittedAt!));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.ok(!body.some((a) => a.id === draft.body.id));
    assert.equal((await call(`/api/applications/${draft.body.id}`)).status, 404);
  });

  it('serves a sealed evidence record whose hash matches its items', async () => {
    const { status, body } = await call<EvidenceRecord>('/api/evidence-records/ER-4821');
    assert.equal(status, 200);
    assert.equal(body.sha256, sealItems(body.items));
  });

  it('validates a new application', async () => {
    const { status, body } = await post<ApiError>('/api/applications', { applicant: { legalName: ' ' }, requestedAmount: 5 });
    assert.equal(status, 422);
    assert.ok(body.error.fields?.legalName);
    assert.ok(body.error.fields?.requestedAmount);
  });

  it('runs the borrower flow: connect, upload, submit, then the reviewer sees it', async () => {
    const created = await post<Application>('/api/applications', {
      applicant: fixtures.sampleApplicant,
      requestedAmount: 4000,
    });
    const id = created.body.id;
    assert.equal(created.body.status, 'draft');

    const connected = await post<DraftEvidence>(`/api/applications/${id}/connections`, { institutionId: 'rbc', profileId: 'steady' });
    assert.ok(connected.body.items.every((i) => i.verified && i.retrievedAt === NOW));
    assert.equal(connected.body.application.connection?.institutionName, 'RBC Royal Bank');

    const uploaded = await post<DraftEvidence>(`/api/applications/${id}/uploads`, { fileName: 'Employment letter.pdf' });
    const upload = uploaded.body.items.find((i) => i.sourceType === 'upload');
    assert.equal(upload?.verified, false);

    const submitted = await post<Application>(`/api/applications/${id}/submit`, {
      applicant: fixtures.sampleApplicant,
      requestedAmount: 4000,
    });
    assert.equal(submitted.body.status, 'ready');
    assert.equal((await call<Application[]>('/api/applications')).body[0]?.id, id);

    const record = await call<EvidenceRecord>(`/api/evidence-records/${submitted.body.evidenceRecordId}`);
    assert.equal(record.body.sha256, sealItems(record.body.items));
    assert.ok(record.body.blindSpots.length > 0);

    const suggestion = await call<Suggestion>(`/api/applications/${id}/suggestion`);
    assert.equal(suggestion.body.outcome, 'approve');
    assert.equal(suggestion.body.offer?.amount, config.pricing.starterLimit);

    assert.equal((await post(`/api/applications/${id}/submit`, {})).status, 409);
  });

  it('requires an override reason, a valid amount and an applicant-facing decline reason', async () => {
    const adjust = await post<ApiError>('/api/applications/4821/decisions', { mode: 'adjust', amount: 100 });
    assert.equal(adjust.status, 422);
    assert.ok(adjust.body.error.fields?.amount);
    assert.ok(adjust.body.error.fields?.overrideNote);

    const same = await post<ApiError>('/api/applications/4821/decisions', { mode: 'adjust', amount: 3000, overrideNote: 'x' });
    assert.ok(same.body.error.fields?.amount);

    const decline = await post<ApiError>('/api/applications/4821/decisions', { mode: 'decline' });
    assert.ok(decline.body.error.fields?.declineReasonId);
    assert.ok(decline.body.error.fields?.overrideNote);
  });

  it('logs a decision once, with the evidence record, and shows it to the borrower', async () => {
    const before = await call<BorrowerView>('/api/applications/4821/borrower-view');
    assert.equal(before.body.outcome.kind, 'in_review');

    const logged = await post<Decision>('/api/applications/4821/decisions', {
      mode: 'adjust',
      amount: 3500,
      overrideNote: 'Applicant told us about a second job at another bank',
    });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.followedSuggestion, false);
    assert.equal(logged.body.evidenceRecordId, 'ER-4821');
    assert.deepEqual(logged.body.offer, quote(3500, config.pricing));

    assert.equal((await post('/api/applications/4821/decisions', { mode: 'follow' })).status, 409);
    assert.equal((await call<Application>('/api/applications/4821')).body.status, 'decided');

    const view = await call<BorrowerView>('/api/applications/4821/borrower-view');
    assert.equal(view.body.outcome.kind, 'approved');
    assert.equal(view.body.outcome.kind === 'approved' && view.body.outcome.offer.amount, 3500);

    assert.equal((await post('/api/applications/4821/borrower-requests', { kind: 'recheck' })).status, 409);
    const accepted = await post<Application>('/api/applications/4821/borrower-requests', { kind: 'accept_offer' });
    assert.equal(accepted.body.borrowerRequests[0]?.kind, 'accept_offer');
  });

  it('shows a declined borrower the model’s reasons and lets them opt into a re-check', async () => {
    const app = await submitSample('stretched');
    const s = await call<Suggestion>(`/api/applications/${app.id}/suggestion`);
    assert.equal(s.body.outcome, 'decline');

    await post(`/api/applications/${app.id}/decisions`, { mode: 'follow' });
    const view = await call<BorrowerView>(`/api/applications/${app.id}/borrower-view`);
    assert.equal(view.body.outcome.kind, 'declined');
    if (view.body.outcome.kind === 'declined') {
      assert.deepEqual(view.body.outcome.reasons, s.body.reasons.map((r) => r.text));
      assert.deepEqual(view.body.outcome.whatWouldChange, s.body.whatWouldChange);
    }

    const recheck = await post<Application>(`/api/applications/${app.id}/borrower-requests`, { kind: 'recheck' });
    assert.equal(recheck.body.borrowerRequests[0]?.recheckOn, '2027-01-21');
  });

  it('blocks decisions on uploads-only applications and records source requests', async () => {
    const res = await post<ApiError>('/api/applications/4815/decisions', { mode: 'follow' });
    assert.equal(res.status, 409);
    const requested = await post<Application>('/api/applications/4815/source-requests', { kind: 'bank_or_payroll' });
    assert.equal(requested.body.sourceRequests[0]?.kind, 'bank_or_payroll');
  });

  it('quotes amounts inside the reviewer range only', async () => {
    const ok = await call<Offer>('/api/quote?amount=3500');
    assert.deepEqual(ok.body, quote(3500, config.pricing));
    assert.equal((await call('/api/quote?amount=100')).status, 422);
  });

  it('resets to the fixtures', async () => {
    const app = await submitSample('steady');
    store.reset();
    assert.equal((await call(`/api/applications/${app.id}`)).status, 404);
  });

  it('returns 404, 405 and 400 where it should', async () => {
    for (const path of ['/api/applications/9999', '/api/evidence-records/ER-0', '/api/nope', '/api/applications/9999/decisions']) {
      assert.equal((await call(path)).status, 404, path);
    }
    assert.equal((await call('/api/config', { method: 'POST' })).status, 405);
    const bad = await fetch(`${base}/api/applications`, { method: 'POST', body: '{not json' });
    assert.equal(bad.status, 400);
  });
});
