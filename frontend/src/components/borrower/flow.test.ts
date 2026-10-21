import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flowReducer, initialFlowState, type FlowEvent, type FlowState } from './flow.ts';

const start = () => initialFlowState({ amount: 4000, applicant: { legalName: '', email: '', phone: '' } });
const run = (state: FlowState, ...events: FlowEvent[]) => events.reduce(flowReducer, state);
const found = { statementLine: 's.csv', tiles: [], factsByCategory: [], factCount: 0, blindSpots: [] };
const toStatement = (s: FlowState) =>
  run(s, { type: 'start' }, { type: 'edit_applicant', field: 'legalName', value: 'Sam Rivera' }, { type: 'continue_about' });

describe('borrower flow', () => {
  it('requires a legal name before leaving "About you"', () => {
    const s = run(start(), { type: 'start' }, { type: 'continue_about' });
    assert.equal(s.step, 'about');
    assert.equal(s.nameError, true);
    const fixed = run(s, { type: 'edit_applicant', field: 'legalName', value: 'Sam Rivera' });
    assert.equal(fixed.nameError, false);
    assert.equal(flowReducer(fixed, { type: 'continue_about' }).step, 'statement');
  });

  it('goes start → about → statement → found', () => {
    const s = run(toStatement(run(start(), { type: 'pick_amount', amount: 2000 })), { type: 'upload_started' });
    assert.equal(s.uploading, true);
    const done = flowReducer(s, { type: 'uploaded', applicationId: '4822', found });
    assert.equal(done.step, 'found');
    assert.equal(done.amount, 2000);
    assert.equal(done.applicationId, '4822');
  });

  it('stays on the upload step with the file’s problem when an upload fails', () => {
    const s = run(toStatement(start()), { type: 'upload_started' }, { type: 'upload_failed', message: 'Row 2: bad date' });
    assert.equal(s.step, 'statement');
    assert.equal(s.uploading, false);
    assert.equal(s.uploadError, 'Row 2: bad date');
    const kept = run(s, { type: 'upload_started' }, { type: 'upload_failed', message: 'x', applicationId: '9' });
    assert.equal(kept.applicationId, '9', 'a rejected file keeps the draft for the retry');
  });

  it('follows the Back map, keeps the application for a re-upload, and has no Back mid-upload', () => {
    const atFound = run(toStatement(start()), { type: 'upload_started' }, { type: 'uploaded', applicationId: '7', found });
    const back = flowReducer(atFound, { type: 'back' });
    assert.equal(back.step, 'statement');
    assert.equal(back.applicationId, '7');
    const uploading = run(back, { type: 'upload_started' });
    assert.equal(flowReducer(uploading, { type: 'back' }).step, 'statement');
  });

  it('ignores events that do not belong to the current step', () => {
    const s = start();
    assert.equal(flowReducer(s, { type: 'upload_started' }), s);
    assert.equal(flowReducer(s, { type: 'submit_started' }), s);
    assert.equal(flowReducer(s, { type: 'uploaded', applicationId: '1', found }), s);
  });
});
