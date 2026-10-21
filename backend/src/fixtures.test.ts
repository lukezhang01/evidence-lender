// Product rules from CLAUDE.md that can be checked mechanically on the sample data.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as fixtures from './fixtures.ts';

const { applications, evidenceRecords, suggestions, decisions, reviewers, sampleProfiles } = fixtures;
const allItems = evidenceRecords.flatMap((r) => r.items);
const profileItems = sampleProfiles.flatMap((p) => p.items);
const isTimestamp = (s: string) => !Number.isNaN(Date.parse(s));

describe('fixtures', () => {
  it('uses unique ids', () => {
    for (const ids of [
      applications.map((a) => a.id),
      evidenceRecords.map((r) => r.id),
      allItems.map((i) => i.id),
      reviewers.map((r) => r.id),
      fixtures.institutions.map((i) => i.id),
      sampleProfiles.map((p) => p.id),
      ...sampleProfiles.map((p) => p.items.map((i) => i.key)),
    ]) {
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it('rule 1: every fact has a source type, reference, detail and retrieved-at time', () => {
    for (const item of allItems) {
      assert.ok(item.sourceType, `${item.id} sourceType`);
      assert.ok(item.sourceRef.trim(), `${item.id} sourceRef`);
      assert.ok(item.sourceDetail.trim(), `${item.id} sourceDetail`);
      assert.ok(isTimestamp(item.retrievedAt), `${item.id} retrievedAt`);
      for (const rec of item.records) assert.ok(isTimestamp(rec.date), `${item.id} record date ${rec.date}`);
    }
  });

  it('rule 1: derived facts name the facts they came from, in the same record', () => {
    for (const record of evidenceRecords) {
      const ids = new Set(record.items.map((i) => i.id));
      for (const item of record.items) {
        if (item.sourceType !== 'derived') {
          assert.equal(item.derivedFrom, undefined, `${item.id} is not derived`);
          continue;
        }
        assert.ok(item.derivedFrom && item.derivedFrom.length > 0, `${item.id} derivedFrom`);
        for (const id of item.derivedFrom) assert.ok(ids.has(id), `${item.id} -> ${id}`);
      }
    }
  });

  it('rule 1: every sample-profile fact has a source detail, and derived facts name their inputs', () => {
    for (const profile of sampleProfiles) {
      const keys = new Set(profile.items.map((i) => i.key));
      for (const item of profile.items) {
        assert.ok(item.sourceDetail.trim(), `${profile.id}/${item.key}`);
        assert.equal(item.sourceType === 'derived', !!item.derivedFrom?.length, `${profile.id}/${item.key}`);
        for (const key of item.derivedFrom ?? []) assert.ok(keys.has(key), `${profile.id}/${item.key} -> ${key}`);
      }
      assert.ok(profile.blindSpots.length > 0, `${profile.id} blind spots`);
      assert.ok(profile.suggestion.reasons.length > 0, `${profile.id} reasons`);
      if (profile.suggestion.outcome === 'decline') {
        assert.ok(profile.suggestion.whatWouldChange.length > 0, `${profile.id} what would change`);
      }
    }
  });

  it('gives each record at most one fact per figure', () => {
    for (const items of [...evidenceRecords.map((r) => r.items), ...sampleProfiles.map((p) => p.items)]) {
      const names = items.flatMap((i) => (i.figure ? [i.figure.name] : []));
      assert.equal(new Set(names).size, names.length);
    }
    assert.ok(profileItems.length > 0);
  });

  it('rule 1: header flags point at a fact in the application’s own record', () => {
    for (const app of applications) {
      const record = evidenceRecords.find((r) => r.id === app.evidenceRecordId);
      for (const flag of app.flags) {
        const item = record?.items.find((i) => i.id === flag.evidenceItemId);
        assert.ok(item, `${app.id} flag ${flag.code}`);
        assert.equal(item.verified, true, `${app.id} flag ${flag.code} rests on a verified fact`);
      }
    }
  });

  it('rule 2: uploads are never verified', () => {
    for (const item of allItems.filter((i) => i.sourceType === 'upload')) {
      assert.equal(item.verified, false, item.id);
    }
  });

  it('rule 2: derived facts are never computed from uploads', () => {
    const byId = new Map(allItems.map((i) => [i.id, i]));
    for (const item of allItems) {
      for (const id of item.derivedFrom ?? []) {
        assert.notEqual(byId.get(id)?.sourceType, 'upload', `${item.id} uses upload ${id}`);
      }
    }
  });

  it('rule 3: every evidence record lists blind spots', () => {
    for (const record of evidenceRecords) {
      assert.ok(record.blindSpots.length > 0, record.id);
      for (const b of record.blindSpots) assert.ok(b.title.trim() && b.note.trim(), record.id);
    }
  });

  it('rule 4: every approve or decline suggestion carries reasons', () => {
    for (const s of suggestions.filter((x) => x.outcome !== 'none')) {
      assert.ok(s.reasons.length > 0, s.applicationId);
      for (const r of s.reasons) assert.ok(r.text.trim(), s.applicationId);
    }
  });

  it('rules 5 and 6: decisions are complete and point at the application’s sealed record', () => {
    for (const d of decisions) {
      const app = applications.find((a) => a.id === d.applicationId);
      assert.ok(app, d.applicationId);
      assert.equal(d.evidenceRecordId, app.evidenceRecordId);
      assert.ok(reviewers.some((r) => r.id === d.reviewerId), d.reviewerId);
      assert.ok(isTimestamp(d.decidedAt));
      if (!d.followedSuggestion) assert.ok(d.overrideNote?.trim(), `${d.applicationId} override note`);
      if (d.outcome === 'declined') assert.ok(d.applicantReason?.trim(), `${d.applicationId} reason`);
    }
  });

  it('keeps application status consistent with the evidence and decisions', () => {
    for (const app of applications) {
      assert.ok(app.submittedAt && isTimestamp(app.submittedAt), `${app.id} submittedAt`);
      const record = evidenceRecords.find((r) => r.id === app.evidenceRecordId);
      const hasDecision = decisions.some((d) => d.applicationId === app.id);
      assert.equal(app.status === 'decided', hasDecision, `${app.id} decided`);
      assert.ok(suggestions.some((s) => s.applicationId === app.id), `${app.id} suggestion`);
      if (app.evidenceRecordId) assert.equal(record?.applicationId, app.id, `${app.id} record`);
      if (app.status === 'ready' || app.status === 'decided') {
        assert.ok(record?.items.some((i) => i.verified), `${app.id} needs verified evidence`);
      }
      if (app.status === 'unverifiable') {
        assert.ok(record && record.items.every((i) => !i.verified), `${app.id} is uploads only`);
      }
    }
    assert.ok(reviewers.some((r) => r.id === fixtures.currentReviewerId));
  });
});
