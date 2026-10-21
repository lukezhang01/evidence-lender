'use client';

import type { DecisionRequest, FieldErrors } from '@evidence-lender/backend/contract';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { decideAction, quoteAction } from '@/lib/actions';
import d from './Decision.module.css';

export interface SuggestionView {
  outcome: 'approve' | 'decline';
  title: string;
  summary: string | null;
  metrics: { label: string; value: string }[];
  metricsSource: string | null;
  reasons: { direction: 'helps' | 'hurts'; text: string }[];
  modelLine: string;
}

interface DecisionPanelProps {
  applicationId: string;
  suggestion: SuggestionView;
  suggestedAmount: number | null;
  // rangeLabel reads like "$500 and $6,000".
  adjust: { min: number; max: number; rangeLabel: string; initialAmount: number; initialPayment: string };
  declineReasons: { id: string; label: string }[];
}

type Mode = 'idle' | 'adjust' | 'decline';

const NOTE_REQUIRED = 'Write why you’re overriding the suggestion. It’s saved with the decision.';
const parseAmount = (v: string) => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
};

export function DecisionPanel({ applicationId, suggestion, suggestedAmount, adjust, declineReasons }: DecisionPanelProps) {
  const [mode, setMode] = useState<Mode>('idle');
  const [amount, setAmount] = useState(String(adjust.initialAmount));
  const [payment, setPayment] = useState(adjust.initialPayment);
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const quoteSeq = useRef(0);

  const approving = suggestion.outcome === 'approve';
  const amountInRange = (n: number | null): n is number => n !== null && n >= adjust.min && n <= adjust.max;

  function reset(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError(null);
    if (next === 'idle') {
      setNote('');
      setReasonId('');
      setAmount(String(adjust.initialAmount));
      setPayment(adjust.initialPayment);
    }
  }

  function onAmount(value: string) {
    setAmount(value);
    setErrors((e) => ({ ...e, amount: undefined }));
    const n = parseAmount(value);
    if (!amountInRange(n)) {
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

  function validate(): { request: DecisionRequest | null; fields: FieldErrors } {
    const fields: FieldErrors = {};
    if (mode === 'adjust') {
      const n = parseAmount(amount);
      if (!amountInRange(n)) fields.amount = `Enter an amount between ${adjust.rangeLabel}.`;
      else if (approving && n === suggestedAmount) fields.amount = 'That’s the suggested amount. Use “Approve as suggested” instead.';
      if (!note.trim()) fields.overrideNote = NOTE_REQUIRED;
      return { request: Object.keys(fields).length ? null : { mode, amount: n!, overrideNote: note }, fields };
    }
    if (!reasonId) fields.declineReasonId = 'Choose the reason the applicant will see.';
    if (approving && !note.trim()) fields.overrideNote = NOTE_REQUIRED;
    return { request: Object.keys(fields).length ? null : { mode: 'decline', declineReasonId: reasonId, overrideNote: note }, fields };
  }

  function send(request: DecisionRequest) {
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

  function confirm() {
    const { request, fields } = validate();
    setErrors(fields);
    if (request) send(request);
  }

  const errorProps = (field: string) =>
    errors[field] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${field}` } : {};
  const fieldError = (field: string) =>
    errors[field] ? (
      <span id={`err-${field}`} className={d.error}>
        {errors[field]}
      </span>
    ) : null;

  const overrideTitle = mode === 'adjust' ? (approving ? 'Adjust terms' : 'Approve instead') : 'Decline application';
  const confirmLabel = mode === 'adjust' ? (approving ? 'Confirm terms' : 'Confirm approval') : 'Confirm decline';
  const needsNote = mode === 'adjust' || approving;

  return (
    <section className={d.panel} aria-labelledby="suggested-decision">
      <div className={d.intro}>
        <span className={d.eyebrow}>Suggested decision</span>
        <h2 id="suggested-decision" className={d.title}>
          {suggestion.title}
        </h2>
        {suggestion.summary && <span className={d.summary}>{suggestion.summary}</span>}
      </div>

      {suggestion.metrics.length > 0 && (
        <div>
          <dl className={d.rows}>
            {suggestion.metrics.map((m) => (
              <div key={m.label} className={d.row}>
                <dt className={d.rowLabel}>{m.label}</dt>
                <dd className={d.rowValue}>{m.value}</dd>
              </div>
            ))}
          </dl>
          {suggestion.metricsSource && <p className={d.caption}>{suggestion.metricsSource}</p>}
        </div>
      )}

      <div className={d.reasons}>
        <h3 className={d.reasonsTitle}>Top reasons</h3>
        <ul className={d.reasonList}>
          {suggestion.reasons.map((r) => (
            <li key={r.text} className={d.reason}>
              <span className={r.direction === 'helps' ? d.helps : d.hurts}>{r.direction === 'helps' ? 'Helps' : 'Hurts'}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        <span className={d.caption}>These are the reasons the applicant sees, in plain words.</span>
      </div>

      {mode === 'idle' ? (
        <div className={d.actions}>
          <Button size="lender" fullWidth disabled={pending} onClick={() => send({ mode: 'follow' })}>
            {pending ? 'Logging…' : approving ? 'Approve as suggested' : 'Decline as suggested'}
          </Button>
          {approving ? (
            <div className={d.pair}>
              <Button size="lender" variant="secondary" disabled={pending} onClick={() => reset('adjust')}>
                Adjust terms
              </Button>
              <Button size="lender" variant="secondary" disabled={pending} onClick={() => reset('decline')}>
                Decline
              </Button>
            </div>
          ) : (
            <Button size="lender" variant="secondary" fullWidth disabled={pending} onClick={() => reset('adjust')}>
              Approve instead
            </Button>
          )}
          {formError && (
            <span className={d.error} role="alert">
              {formError}
            </span>
          )}
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
          <h3 className={d.overrideTitle}>{overrideTitle}</h3>

          {mode === 'adjust' && (
            <div className={d.field}>
              <label htmlFor="f-amount" className={d.label}>
                New amount
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
                {`Between ${adjust.rangeLabel}. Payment: ${payment} a month.`}
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
            <label htmlFor="f-override" className={d.label}>
              {needsNote ? 'Why are you overriding the suggestion?' : 'Note for the record (optional)'}
            </label>
            <textarea
              id="f-override"
              rows={3}
              className={d.textarea}
              placeholder="Applicant told us about a second job at another bank"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setErrors((x) => ({ ...x, overrideNote: undefined }));
              }}
              {...errorProps('overrideNote')}
            />
            {needsNote && <span className={d.hint}>Required. Saved with the decision for audit and model review.</span>}
            {fieldError('overrideNote')}
          </div>

          {formError && (
            <span className={d.error} role="alert">
              {formError}
            </span>
          )}
          <div className={d.pair}>
            <Button type="submit" size="lender" disabled={pending}>
              {pending ? 'Logging…' : confirmLabel}
            </Button>
            <Button size="lender" variant="secondary" disabled={pending} onClick={() => reset('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <span className={d.model}>{suggestion.modelLine}</span>
    </section>
  );
}
