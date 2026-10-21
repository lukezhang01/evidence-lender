// Product rules from CLAUDE.md that can be checked mechanically on the sample data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { loadProductConfig } from './config.ts';
import * as fixtures from './fixtures.ts';
import { coversMonths, parseStatement } from './statement.ts';
import { createStore } from './store.ts';

const config = loadProductConfig();
const store = createStore(config, fixtures);
const applications = store.listApplications();
const records = applications.map((a) => store.getEvidenceRecord(a.evidenceRecordId!)!);
const isTimestamp = (s: string) => !Number.isNaN(Date.parse(s));

describe('fixtures', () => {
  it('uses unique ids', () => {
    for (const ids of [
      fixtures.applicationSeeds.map((a) => a.id),
      fixtures.sampleStatements.map((s) => s.id),
      fixtures.reviewers.map((r) => r.id),
      records.flatMap((r) => r.items.map((i) => i.id)),
    ]) {
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it('has sample statements that parse and cover the minimum period', () => {
    for (const s of fixtures.sampleStatements) {
      const parsed = parseStatement(s.csv);
      assert.ok(parsed.hasBalance, s.id);
      assert.ok(coversMonths(parsed, config.borrower.minimumStatementMonths), s.id);
    }
  });

  it('matches the files in samples/ (npm run samples -w backend rewrites them)', () => {
    assert.equal(new Set(fixtures.sampleFiles.map((f) => f.name)).size, fixtures.sampleFiles.length);
    for (const f of fixtures.sampleFiles) {
      assert.equal(readFileSync(new URL(`../../samples/${f.name}`, import.meta.url), 'utf8'), f.csv, f.name);
    }
  });

  it('loads every seeded application with a sealed record', () => {
    assert.equal(applications.length, fixtures.applicationSeeds.length);
    for (const app of applications) {
      assert.ok(app.statement && app.submittedAt && isTimestamp(app.submittedAt), app.id);
      assert.equal(store.getEvidenceRecord(app.evidenceRecordId!)?.applicationId, app.id);
    }
  });

  it('rule 1: every fact has a source type, reference, detail and time', () => {
    for (const item of records.flatMap((r) => r.items)) {
      assert.ok(item.sourceType && item.sourceRef.trim() && item.sourceDetail.trim(), item.id);
      assert.ok(isTimestamp(item.retrievedAt), item.id);
    }
  });

  it('rule 2: uploaded facts are never verified', () => {
    for (const item of records.flatMap((r) => r.items)) assert.equal(item.verified, false, item.id);
  });

  it('rule 3: every record lists blind spots', () => {
    for (const r of records) assert.ok(r.blindSpots.length > 0, r.id);
  });

  it('rule 1: every experimental score names its model, statement file and time', () => {
    for (const r of records) {
      const s = r.experimentalScore;
      const app = store.getApplication(r.applicationId)!;
      assert.ok(s.model.id.trim() && /^[0-9a-f]{64}$/.test(s.model.sha256), r.id);
      assert.equal(s.statementSha256, app.statement?.fileSha256, r.id);
      assert.equal(s.computedAt, r.sealedAt, r.id);
      assert.equal(s.status, 'scored', `${r.id}: the sample statements cover six months with balances`);
    }
  });

  it('rules 5 and 6: decisions carry a written reason and point at the sealed record', () => {
    for (const d of fixtures.decisions) {
      const app = store.getApplication(d.applicationId);
      assert.equal(app?.status, 'decided');
      assert.equal(d.evidenceRecordId, app?.evidenceRecordId);
      assert.ok(d.overrideNote?.trim(), d.id);
      assert.equal(d.followedSuggestion, false, 'no suggestion is made from uploads');
      if (d.outcome === 'declined') assert.ok(d.applicantReason?.trim(), d.id);
      assert.ok(fixtures.reviewers.some((r) => r.id === d.reviewerId));
    }
    assert.ok(fixtures.reviewers.some((r) => r.id === fixtures.currentReviewerId));
  });
});
