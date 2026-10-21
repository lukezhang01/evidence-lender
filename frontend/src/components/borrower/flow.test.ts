import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flowReducer, initialFlowState, type FlowEvent, type FlowState } from './flow.ts';

const start = () =>
  initialFlowState({ amount: 4000, applicant: { legalName: '', email: '', phone: '' }, profileId: null });
const run = (state: FlowState, ...events: FlowEvent[]) => events.reduce(flowReducer, state);
const found = { institutionName: 'RBC Royal Bank', tiles: [], factsByCategory: [], factCount: 0, uploads: [] };

describe('borrower flow', () => {
  it('requires a legal name before leaving "About you"', () => {
    const s = run(start(), { type: 'start' }, { type: 'continue_about' });
    assert.equal(s.step, 'about');
    assert.equal(s.nameError, true);

    const fixed = run(s, { type: 'edit_applicant', field: 'legalName', value: 'Sam Rivera' });
    assert.equal(fixed.nameError, false);
    assert.equal(flowReducer(fixed, { type: 'continue_about' }).step, 'consent');
  });

  it('goes start → about → consent → bank → connecting → found', () => {
    const s = run(
      start(),
      { type: 'pick_amount', amount: 2000 },
      { type: 'start' },
      { type: 'edit_applicant', field: 'legalName', value: 'Sam Rivera' },
      { type: 'continue_about' },
      { type: 'go_bank' },
      { type: 'pick_bank', institution: { id: 'rbc', name: 'RBC Royal Bank' } },
    );
    assert.equal(s.step, 'connecting');
    assert.equal(s.amount, 2000);
    const done = flowReducer(s, { type: 'connected', applicationId: '4822', found });
    assert.equal(done.step, 'found');
    assert.equal(done.applicationId, '4822');
  });

  it('returns to the bank list with a message when a connection fails', () => {
    const s = run(
      start(),
      { type: 'start' },
      { type: 'edit_applicant', field: 'legalName', value: 'A' },
      { type: 'continue_about' },
      { type: 'go_bank' },
      { type: 'pick_bank', institution: { id: 'rbc', name: 'RBC Royal Bank' } },
      { type: 'connect_failed', message: 'Try again' },
    );
    assert.equal(s.step, 'bank');
    assert.equal(s.connectError, 'Try again');
  });

  it('follows the Back map and has no Back while connecting', () => {
    const atConsent = run(
      start(),
      { type: 'start' },
      { type: 'edit_applicant', field: 'legalName', value: 'A' },
      { type: 'continue_about' },
    );
    assert.equal(run(atConsent, { type: 'go_manual' }, { type: 'back' }).step, 'consent');
    assert.equal(run(atConsent, { type: 'back' }).step, 'about');
    const connecting = run(atConsent, { type: 'go_bank' }, { type: 'pick_bank', institution: { id: 'x', name: null } });
    assert.equal(flowReducer(connecting, { type: 'back' }).step, 'connecting');
  });

  it('ignores events that do not belong to the current step', () => {
    const s = start();
    assert.equal(flowReducer(s, { type: 'go_bank' }), s);
    assert.equal(flowReducer(s, { type: 'submit_started' }), s);
    assert.equal(flowReducer(s, { type: 'connected', applicationId: '1', found }), s);
  });
});
