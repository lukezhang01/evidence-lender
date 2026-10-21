'use client';

import type { Applicant } from '@evidence-lender/backend/contract';
import { Button } from '@/components/ui/Button';
import s from './borrower.module.css';
import own from './steps.module.css';

const heading = { tabIndex: -1, 'data-step-heading': true } as const;

// ---- start -----------------------------------------------------------------

const howItWorks = [
  { title: 'Tell us who you are', body: 'Three fields, about a minute' },
  { title: 'Upload a bank statement', body: 'A CSV file from your online banking. It replaces pay stubs.' },
  { title: 'Check what we found, then get a decision', body: 'You see our numbers before anyone else does.' },
];

export function StartStep(props: {
  amounts: { value: number; label: string }[];
  amount: number;
  onPick: (amount: number) => void;
  onStart: () => void;
}) {
  return (
    <div className={s.screenLoose}>
      <div className={s.introLoose}>
        <h1 className={s.title} {...heading}>
          A loan based on how you handle money today
        </h1>
        <p className={s.leadLarge}>
          New to Canada, or rebuilding after a hard year? We look at your income and the bills you
          already pay on time, not just a credit score.
        </p>
      </div>

      <div className={own.amountGroup} role="group" aria-labelledby="amount-label">
        <span id="amount-label" className={s.label}>
          How much do you need?
        </span>
        <div className={own.amounts}>
          {props.amounts.map((a) => (
            <button
              key={a.value}
              type="button"
              className={own.amount}
              aria-pressed={a.value === props.amount}
              onClick={() => props.onPick(a.value)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className={own.how}>
        <span className={own.howLabel}>How it works</span>
        <ol className={own.howList}>
          {howItWorks.map((step, i) => (
            <li key={step.title} className={own.howStep}>
              <span className={own.howNumber} aria-hidden="true">
                {i + 1}
              </span>
              <span className={own.howText}>
                <span className={own.howTitle}>{step.title}</span>
                <span className={own.howBody}>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Button fullWidth onClick={props.onStart}>
        Get started
      </Button>
      <p className={s.footnote}>You don’t need a credit score to apply.</p>
    </div>
  );
}

// ---- about -----------------------------------------------------------------

export function AboutStep(props: {
  applicant: Applicant;
  nameError: boolean;
  onEdit: (field: keyof Applicant, value: string) => void;
  onContinue: () => void;
}) {
  const { applicant } = props;
  return (
    <form
      className={s.screen}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        props.onContinue();
      }}
    >
      <div className={s.intro}>
        <h2 className={s.heading} {...heading}>
          About you
        </h2>
        <p className={s.lead}>So we know who’s applying and how to reach you. That’s all we ask for.</p>
      </div>
      <div className={s.field}>
        <label htmlFor="f-name" className={s.label}>
          Full legal name
        </label>
        <input
          id="f-name"
          className={s.input}
          type="text"
          autoComplete="name"
          value={applicant.legalName}
          onChange={(e) => props.onEdit('legalName', e.target.value)}
          aria-invalid={props.nameError}
          aria-describedby={props.nameError ? 'f-name-error' : undefined}
          autoFocus={props.nameError}
        />
        {props.nameError && (
          <span id="f-name-error" className={s.fieldError}>
            Enter your full legal name.
          </span>
        )}
      </div>
      <div className={s.field}>
        <label htmlFor="f-email" className={s.label}>
          Email
        </label>
        <input
          id="f-email"
          className={s.input}
          type="email"
          autoComplete="email"
          value={applicant.email}
          onChange={(e) => props.onEdit('email', e.target.value)}
        />
      </div>
      <div className={s.field}>
        <label htmlFor="f-phone" className={s.label}>
          Mobile number
        </label>
        <input
          id="f-phone"
          className={s.input}
          type="tel"
          autoComplete="tel"
          value={applicant.phone}
          onChange={(e) => props.onEdit('phone', e.target.value)}
        />
      </div>
      <Button type="submit" fullWidth>
        Continue
      </Button>
    </form>
  );
}

