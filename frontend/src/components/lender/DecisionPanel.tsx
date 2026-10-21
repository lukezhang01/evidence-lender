'use client';

import type { DecisionRequest, FieldErrors } from '@evidence-lender/backend/contract';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { decideAction, quoteAction } from '@/lib/actions';
import d from './Decision.module.css';

interface DecisionPanelProps {
  applicationId: string;
  requestedLabel: string;
  // rangeLabel reads like "$500 and $6,000".
  approve: { min: number; max: number; rangeLabel: string; initialAmount: number; initialPayment: string; termsLine: string };
  declineReasons: { id: string; label: string }[];
}

type Mode = 'idle' | 'approve' | 'decline';

const NOTE_REQUIRED = 'Write why you’re deciding this way. It’s saved with the decision.';
const parseAmount = (v: string) => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

// Nothing here is verified at source, so no suggestion is made (rule 2): the
// reviewer decides and always writes why (rule 5). The backend checks the same.
export function DecisionPanel({ applicationId, requestedLabel, approve, declineReasons }: DecisionPanelProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [amount, setAmount] = useState(String(approve.initialAmount));
  const [payment, setPayment] = useState(approve.initialPayment);
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quoteSeq = useRef(0);

  const inRange = (n: number | null): n is number => n !== null && n >= approve.min && n <= approve.max;

  function choose(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError(null);
  }

  function onAmount(value: string) {
    setAmount(value);
    setErrors((e) => ({ ...e, amount: undefined }));
    const n = parseAmount(value);
    if (!inRange(n)) {
      setPayment('—');
      return;
    }
    const seq = ++quoteSeq.current;
    quoteAction(n)
      .then((q) => {
        if (seq === quoteSeq.current) setPayment(q?.monthlyPayment ?? '—');
      })
      .catch(() => undefined);
  }

  function confirm() {
    const fields: FieldErrors = {};
    if (!note.trim()) fields.note = NOTE_REQUIRED;
    let request: DecisionRequest;
    if (mode === 'approve') {
      const n = parseAmount(amount);
      if (!inRange(n)) fields.amount = `Enter an amount between ${approve.rangeLabel}.`;
      request = { outcome: 'approved', amount: n ?? 0, note };
    } else {
      if (!reasonId) fields.declineReasonId = 'Choose the reason the applicant will see.';
      request = { outcome: 'declined', declineReasonId: reasonId, note };
    }
    setErrors(fields);
    if (Object.keys(fields).length) return;

    setFormError(null);
    startTransition(async () => {
      const result = await decideAction(applicationId, request).catch(() => null);
      if (!result) setFormError('We couldn’t reach the server. Nothing was logged. Try again.');
      else if (!result.ok) {
        setErrors(result.fields);
        setFormError(result.message);
      }
    });
  }

  const errorProps = (field: string) =>
    errors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${field}` } : {};
  const fieldError = (field: string) =>
    errors[field] ? (
      <span id={`err-${field}`} className={d.error}>
        {errors[field]}
      </span>
    ) : null;

  return (
    <section className={d.panel} aria-labelledby="decision-heading">
      <div className={d.intro}>
        <span className={d.eyebrow}>Your decision</span>
        <h2 id="decision-heading" className={d.title}>
          No automated suggestion
        </h2>
        <span className={d.summary}>
          Everything here comes from a statement the applicant uploaded, so nothing is verified at source. Read the
          facts, then approve or decline. The applicant asked for {requestedLabel}.
        </span>
      </div>

      {mode === 'idle' ? (
        <div className={d.pair}>
          <Button size="lender" onClick={() => choose('approve')}>
            Approve
          </Button>
          <Button size="lender" variant="secondary" onClick={() => choose('decline')}>
            Decline
          </Button>
        </div>
      ) : (
        <form
          className={d.override}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <h3 className={d.overrideTitle}>{mode === 'approve' ? 'Approve' : 'Decline application'}</h3>

          {mode === 'approve' && (
            <div className={d.field}>
              <label htmlFor="f-amount" className={d.label}>
                Amount
              </label>
              <input
                id="f-amount"
                className={d.input}
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => onAmount(e.target.value)}
                {...errorProps('amount')}
              />
              <span className={d.hint} aria-live="polite">
                {`Between ${approve.rangeLabel}. ${approve.termsLine} Payment: ${payment} a month.`}
              </span>
              {fieldError('amount')}
            </div>
          )}

          {mode === 'decline' && (
            <div className={d.field}>
              <label htmlFor="f-decline-reason" className={d.label}>
                Reason the applicant sees
              </label>
              <select
                id="f-decline-reason"
                className={d.input}
                value={reasonId}
                onChange={(e) => {
                  setReasonId(e.target.value);
                  setErrors((x) => ({ ...x, declineReasonId: undefined }));
                }}
                {...errorProps('declineReasonId')}
              >
                <option value="">Choose a reason</option>
                {declineReasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {fieldError('declineReasonId')}
            </div>
          )}

          <div className={d.field}>
            <label htmlFor="f-note" className={d.label}>
              Why are you deciding this way?
            </label>
            <textarea
              id="f-note"
              rows={3}
              className={d.textarea}
              placeholder="Pay arrives every two weeks and rent is paid every month; the balance never went below zero"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setErrors((x) => ({ ...x, note: undefined }));
              }}
              {...errorProps('note')}
            />
            <span className={d.hint}>Required. Saved with the decision for audit.</span>
            {fieldError('note')}
          </div>

          {formError && (
            <span className={d.error} role="alert">
              {formError}
            </span>
          )}
          <div className={d.pair}>
            <Button type="submit" size="lender" disabled={pending}>
              {pending ? 'Logging…' : mode === 'approve' ? 'Confirm approval' : 'Confirm decline'}
            </Button>
            <Button size="lender" variant="secondary" disabled={pending} onClick={() => choose('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
