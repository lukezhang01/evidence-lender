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
} from './contract.ts';
import * as fixtures from './fixtures.ts';
import { quote } from './pricing.ts';
import { sealItems } from './seal.ts';
import { createStore } from './store.ts';

const config = loadProductConfig();
const NOW = '2026-10-21T14:00:00.000Z';
const sample = (id: string) => fixtures.sampleStatements.find((s) => s.id === id)!;

describe('pricing', () => {
  it('matches the prototype’s level-payment formula', () => {
    const offer = quote(3000, config.pricing);
    const r = config.pricing.apr / 12;
    const expected = Math.round(((3000 * r) / (1 - (1 + r) ** -config.pricing.termMonths)) * 100) / 100;
    assert.equal(offer.monthlyPayment, expected);
    assert.equal(offer.totalCostOfBorrowing, Math.round((expected * config.pricing.termMonths - 3000) * 100) / 100);
  });
});

describe('HTTP API', () => {
  let server: Server;
  let base: string;
  const store = createStore(config, fixtures, { now: () => new Date(NOW) });

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
  const draft = async () =>
    (await post<Application>('/api/applications', { applicant: fixtures.sampleApplicant, requestedAmount: 4000 })).body;

  async function submitted(statementId = 'steady'): Promise<Application> {
    const app = await draft();
    const s = sample(statementId);
    assert.equal((await post(`/api/applications/${app.id}/statement`, { fileName: s.fileName, csv: s.csv })).status, 201);
    const res = await post<Application>(`/api/applications/${app.id}/submit`, {
      applicant: fixtures.sampleApplicant,
      requestedAmount: 4000,
      borrowerNote: 'July pay was short.',
    });
    assert.equal(res.status, 200);
    return res.body;
  }

  it('serves config with the sample-data flag and the borrower’s sample statements', async () => {
    const { body } = await call<ConfigResponse>('/api/config');
    assert.equal(body.sampleData, true);
    assert.deepEqual(
      body.demo?.sampleStatements.map((s) => s.id),
      fixtures.sampleStatements.filter((s) => s.forBorrowers).map((s) => s.id),
    );
    const csv = await call<{ csv: string }>(`/api/demo/statements/${body.demo!.sampleStatements[0]!.id}`);
    assert.match(csv.body.csv, /^Date,Description,Amount,Balance/);
  });

  it('lists submitted applications newest first, never drafts', async () => {
    const d = await draft();
    const { body } = await call<Application[]>('/api/applications');
    const times = body.map((a) => Date.parse(a.submittedAt!));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.ok(!body.some((a) => a.id === d.id));
    assert.equal((await call(`/api/applications/${d.id}`)).status, 404);
  });

  it('validates a new application', async () => {
    const { status, body } = await post<ApiError>('/api/applications', { applicant: { legalName: ' ' }, requestedAmount: 5 });
    assert.equal(status, 422);
    assert.ok(body.error.fields?.legalName);
    assert.ok(body.error.fields?.requestedAmount);
  });

  it('turns an uploaded CSV into unverified facts, and explains a bad file', async () => {
    const app = await draft();
    const s = sample('steady');
    const ok = await post<DraftEvidence>(`/api/applications/${app.id}/statement`, { fileName: s.fileName, csv: s.csv });
    assert.ok(ok.body.items.length > 0);
    assert.ok(ok.body.items.every((i) => !i.verified && i.retrievedAt === NOW));
    assert.equal(ok.body.application.statement?.fileName, s.fileName);
    assert.ok(ok.body.blindSpots.length > 0);

    const bad = await post<ApiError>(`/api/applications/${app.id}/statement`, { fileName: 'x.csv', csv: 'Date,Amount\n' });
    assert.equal(bad.status, 422);
    assert.match(bad.body.error.fields!.statement!, /Description/);

    const short = await post<ApiError>(`/api/applications/${app.id}/statement`, {
      fileName: 'x.csv',
      csv: 'Date,Description,Amount\n2026-10-01,PAY,100\n2026-10-20,RENT,-50\n',
    });
    assert.match(short.body.error.message, /at least 3 months/);
  });

  it('won’t submit without a statement, then seals one when it has it', async () => {
    const app = await draft();
    const early = await post<ApiError>(`/api/applications/${app.id}/submit`, { applicant: fixtures.sampleApplicant, requestedAmount: 4000 });
    assert.ok(early.body.error.fields?.statement);

    const done = await submitted();
    assert.equal(done.status, 'ready');
    assert.equal(done.borrowerNote, 'July pay was short.');
    assert.equal((await call<Application[]>('/api/applications')).body[0]?.id, done.id);
    const record = await call<EvidenceRecord>(`/api/evidence-records/${done.evidenceRecordId}`);
    assert.equal(record.body.sha256, sealItems(record.body.items));
    assert.equal((await post(`/api/applications/${done.id}/submit`, {})).status, 409);
  });

  it('requires a written reason, a valid amount and an applicant-facing decline reason', async () => {
    const approve = await post<ApiError>('/api/applications/4821/decisions', { outcome: 'approved', amount: 100 });
    assert.equal(approve.status, 422);
    assert.ok(approve.body.error.fields?.amount);
    assert.ok(approve.body.error.fields?.note);

    const decline = await post<ApiError>('/api/applications/4821/decisions', { outcome: 'declined', note: 'x' });
    assert.ok(decline.body.error.fields?.declineReasonId);
    assert.equal(decline.body.error.fields?.note, undefined);
  });

  it('logs one decision, shows it to the borrower and takes their follow-up', async () => {
    assert.equal((await call<BorrowerView>('/api/applications/4821/borrower-view')).body.outcome.kind, 'in_review');
    const logged = await post<Decision>('/api/applications/4821/decisions', {
      outcome: 'approved',
      amount: 2500,
      note: 'Regular pay and rent every month; starting below the request.',
    });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.followedSuggestion, false);
    assert.equal(logged.body.evidenceRecordId, 'ER-4821');
    assert.deepEqual(logged.body.offer, quote(2500, config.pricing));

    assert.equal((await post('/api/applications/4821/decisions', { outcome: 'declined', declineReasonId: 'other', note: 'x' })).status, 409);
    const view = await call<BorrowerView>('/api/applications/4821/borrower-view');
    assert.equal(view.body.outcome.kind === 'approved' && view.body.outcome.offer.amount, 2500);

    assert.equal((await post('/api/applications/4821/borrower-requests', { kind: 'recheck' })).status, 409);
    const accepted = await post<Application>('/api/applications/4821/borrower-requests', { kind: 'accept_offer' });
    assert.equal(accepted.body.borrowerRequests[0]?.kind, 'accept_offer');
  });

  it('shows a declined borrower the chosen reason and lets them opt into a re-check', async () => {
    const app = await submitted('tight');
    await post(`/api/applications/${app.id}/decisions`, {
      outcome: 'declined',
      declineReasonId: 'not_enough_left_over',
      note: 'More went out than came in, and the balance went below zero.',
    });
    const view = await call<BorrowerView>(`/api/applications/${app.id}/borrower-view`);
    const reason = config.declineReasons.find((r) => r.id === 'not_enough_left_over')!;
    assert.deepEqual(view.body.outcome, { kind: 'declined', reasons: [reason.label], whatWouldChange: reason.whatWouldChange });

    const recheck = await post<Application>(`/api/applications/${app.id}/borrower-requests`, { kind: 'recheck' });
    assert.equal(recheck.body.borrowerRequests[0]?.recheckOn, '2027-01-21');
  });

  it('quotes amounts inside the reviewer range only', async () => {
    const ok = await call<Offer>('/api/quote?amount=3500');
    assert.deepEqual(ok.body, quote(3500, config.pricing));
    assert.equal((await call('/api/quote?amount=100')).status, 422);
  });

  it('resets to the fixtures', async () => {
    const app = await submitted();
    store.reset();
    assert.equal((await call(`/api/applications/${app.id}`)).status, 404);
  });

  it('returns 404, 405 and 400 where it should', async () => {
    for (const path of ['/api/applications/9999', '/api/evidence-records/ER-0', '/api/nope', '/api/demo/statements/semimonthly']) {
      assert.equal((await call(path)).status, 404, path);
    }
    assert.equal((await call('/api/config', { method: 'POST' })).status, 405);
    const bad = await fetch(`${base}/api/applications`, { method: 'POST', body: '{not json' });
    assert.equal(bad.status, 400);
  });
});
