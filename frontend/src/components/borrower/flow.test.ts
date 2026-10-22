import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { flowReducer, initialFormState, parseAmount, validate, type FormEvent, type FormState } from './flow.ts';

const run = (state: FormState, ...events: FormEvent[]) => events.reduce(flowReducer, state);
const range = { min: 500, max: 6000, message: 'Enter a whole amount from $500 to $6,000.' };
const filled = () =>
  run(
    initialFormState,
    { type: 'edit', field: 'requestedAmount', value: '$2,750' },
    { type: 'edit', field: 'legalName', value: 'Sam Rivera' },
    { type: 'edit', field: 'email', value: 'sam@example.com' },
    { type: 'file_chosen', fileName: 's.csv', csv: 'Date,Amount\n' },
  );

describe('borrower application form', () => {
  it('reads typed amounts as whole numbers', () => {
    assert.equal(parseAmount('$4,000'), 4000);
    assert.equal(parseAmount(' 2750 '), 2750);
    assert.equal(parseAmount('2750.50'), null);
    assert.equal(parseAmount('four thousand'), null);
    assert.equal(parseAmount(''), null);
  });

  it('asks for an amount in range, a name, an email and a statement', () => {
    assert.deepEqual(Object.keys(validate(initialFormState, range)).sort(), [
      'email',
      'legalName',
      'requestedAmount',
      'statement',
    ]);
    assert.deepEqual(validate(filled(), range), {});
    const tooMuch = run(filled(), { type: 'edit', field: 'requestedAmount', value: '6001' });
    assert.equal(validate(tooMuch, range).requestedAmount, range.message);
    const badEmail = run(filled(), { type: 'edit', field: 'email', value: 'sam@' });
    assert.ok(validate(badEmail, range).email);
  });

  it('clears a field’s error when it changes', () => {
    const s = run(initialFormState, { type: 'invalid', errors: validate(initialFormState, range) });
    const fixed = run(s, { type: 'edit', field: 'legalName', value: 'Sam' }, { type: 'file_chosen', fileName: 'a.csv', csv: 'x' });
    assert.equal(fixed.errors.legalName, undefined);
    assert.equal(fixed.errors.statement, undefined);
    assert.ok(fixed.errors.email);
  });

  it('drops a rejected file and says why', () => {
    const s = run(filled(), { type: 'file_rejected', message: 'PDFs aren’t supported' });
    assert.equal(s.file, null);
    assert.equal(s.errors.statement, 'PDFs aren’t supported');
  });

  it('keeps the draft for a retry and shows the file’s problem by the file', () => {
    const s = run(filled(), { type: 'submit_started' }, {
      type: 'submit_failed',
      message: 'Row 2: bad date',
      fields: { statement: 'Row 2: bad date' },
      applicationId: '4822',
    });
    assert.equal(s.submitting, false);
    assert.equal(s.applicationId, '4822');
    assert.equal(s.errors.statement, 'Row 2: bad date');
    assert.equal(s.formError, null);
    const again = run(s, { type: 'submit_started' }, { type: 'submit_failed', message: 'Gone', fields: {}, applicationId: null });
    assert.equal(again.applicationId, '4822');
    assert.equal(again.formError, 'Gone');
  });

  it('ignores edits and a second submit while submitting', () => {
    const s = run(filled(), { type: 'submit_started' });
    assert.equal(flowReducer(s, { type: 'submit_started' }), s);
    assert.equal(flowReducer(s, { type: 'edit', field: 'email', value: 'x' }), s);
    assert.equal(flowReducer(s, { type: 'file_chosen', fileName: 'b.csv', csv: 'y' }), s);
  });
});
