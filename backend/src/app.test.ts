import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { createRequestHandler } from './app.ts';
import { loadProductConfig } from './config.ts';
import type { Application, ConfigResponse, EvidenceRecord, Suggestion } from './contract.ts';
import * as fixtures from './fixtures.ts';
import { sealItems } from './seal.ts';
import { createStore } from './store.ts';

const config = loadProductConfig();

describe('store', () => {
  it('prices an approval from config, capped at the starter limit', () => {
    const store = createStore(config, fixtures);
    const s = store.getSuggestion('4821');
    assert.equal(s?.outcome, 'approve');
    assert.equal(s?.amount, Math.min(4000, config.pricing.starterLimit));
    assert.equal(s?.apr, config.pricing.apr);
    assert.equal(s?.termMonths, config.pricing.termMonths);
  });

  it('makes no suggestion when the only evidence is uploads, whatever the model said', () => {
    const uploadsOnly = fixtures.evidenceRecords.find((r) => r.id === 'ER-4815')!;
    const tampered = {
      ...fixtures,
      suggestions: fixtures.suggestions.map((s) =>
        s.applicationId === '4815'
          ? { ...s, outcome: 'approve' as const, reasons: [{ direction: 'helps' as const, text: 'x' }] }
          : s,
      ),
    };
    const s = createStore(config, tampered).getSuggestion(uploadsOnly.applicationId);
    assert.equal(s?.outcome, 'none');
    assert.equal(s?.amount, undefined);
    assert.deepEqual(s?.reasons, []);
  });
});

describe('HTTP API', () => {
  let server: Server;
  let base: string;

  before(async () => {
    server = createServer(createRequestHandler(createStore(config, fixtures)));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const get = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init);

  it('serves config with the sample-data flag', async () => {
    const body = (await (await get('/api/config')).json()) as ConfigResponse;
    assert.equal(body.sampleData, true);
    assert.deepEqual(body.borrower, config.borrower);
  });

  it('lists applications newest first', async () => {
    const body = (await (await get('/api/applications')).json()) as Application[];
    const times = body.map((a) => Date.parse(a.submittedAt));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    assert.equal(body.length, fixtures.applications.length);
  });

  it('serves a sealed evidence record whose hash matches its items', async () => {
    const res = await get('/api/evidence-records/ER-4821');
    assert.equal(res.status, 200);
    const record = (await res.json()) as EvidenceRecord;
    assert.equal(record.sha256, sealItems(record.items));
  });

  it('serves a suggestion for an application with no evidence yet', async () => {
    const s = (await (await get('/api/applications/4819/suggestion')).json()) as Suggestion;
    assert.equal(s.outcome, 'none');
  });

  it('returns 404 for unknown ids and paths', async () => {
    for (const path of ['/api/applications/9999', '/api/evidence-records/ER-0', '/api/nope', '/api/applications/9999/decisions']) {
      const res = await get(path);
      assert.equal(res.status, 404, path);
      assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'not_found');
    }
  });

  it('rejects writes for now', async () => {
    const res = await get('/api/applications', { method: 'POST' });
    assert.equal(res.status, 405);
  });
});
