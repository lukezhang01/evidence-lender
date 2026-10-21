'use client';

import type { Applicant, Institution, SampleProfileSummary } from '@evidence-lender/backend/contract';
import { Button } from '@/components/ui/Button';
import { BankIcon, CheckIcon, ChevronRightIcon, CrossIcon, EyeIcon } from '@/components/ui/icons';
import type { ManualChoice } from './flow';
import s from './borrower.module.css';
import own from './steps.module.css';

const heading = { tabIndex: -1, 'data-step-heading': true } as const;

// ---- start -----------------------------------------------------------------

const howItWorks = [
  { title: 'Tell us who you are', body: 'Three fields, about a minute' },
  { title: 'Connect your bank', body: 'Read-only. It replaces pay stubs and statements.' },
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
        <p className={s.lead}>We use these to match your bank account to you. That’s all we ask for.</p>
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

// ---- consent ---------------------------------------------------------------

export function ConsentStep(props: { historyMonths: number; onConnect: () => void; onManual: () => void }) {
  return (
    <div className={s.screen}>
      <div className={s.intro}>
        <h2 className={s.heading} {...heading}>
          Show us your real income
        </h2>
        <p className={s.lead}>
          Connect your bank and we’ll read the last {props.historyMonths} months. It replaces pay stubs and
          statements, and it’s how we can say yes without a credit score.
        </p>
      </div>
      <div className={own.consentGrid}>
        <div className={own.canRead}>
          <span className={own.panelTitleAccent}>What we read</span>
          {['Pay deposits', 'Rent and bills you pay', 'Balances over time'].map((t) => (
            <div key={t} className={s.checkRow}>
              <span className={s.iconAccent}>
                <CheckIcon />
              </span>
              {t}
            </div>
          ))}
        </div>
        <div className={own.cannot}>
          <span className={own.panelTitle}>What we can’t do</span>
          {['Move money', 'See your password', 'Keep reading after you disconnect'].map((t) => (
            <div key={t} className={s.checkRow}>
              <span className={s.iconMuted}>
                <CrossIcon />
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>
      <div className={own.note}>
        <span className={s.iconAccent}>
          <EyeIcon size={18} />
        </span>
        <span>You’ll see everything we found before you submit, and you can correct it.</span>
      </div>
      <div className={s.actions}>
        <Button fullWidth onClick={props.onConnect}>
          Connect bank
        </Button>
        <button type="button" className={s.linkButton} onClick={props.onManual}>
          Verify another way
        </button>
      </div>
      <p className={s.footnote}>Read-only access · Disconnect any time</p>
    </div>
  );
}

// ---- manual ----------------------------------------------------------------

const manualOptions: { id: ManualChoice; title: string; desc: string; note: string }[] = [
  {
    id: 'payroll',
    title: 'Connect your payroll account',
    desc: 'Pay and employer, straight from the source. Read-only.',
    note: 'Payroll data comes straight from the source, so it counts the same as bank data.',
  },
  {
    id: 'upload',
    title: 'Upload bank statements',
    desc: 'Your last 3 months, as PDFs',
    note: 'Uploaded statements can’t be traced back to your bank, so a person checks them and they count for less.',
  },
  {
    id: 'employer',
    title: 'Have your employer confirm',
    desc: 'We email them a short form',
    note: 'We’ll email your employer a short form. Once they reply, a person reviews it.',
  },
];

export function ManualStep(props: {
  choice: ManualChoice | null;
  onPick: (choice: ManualChoice) => void;
  onConnect: () => void;
}) {
  const selected = manualOptions.find((m) => m.id === props.choice);
  return (
    <div className={s.screen}>
      <div className={s.intro}>
        <h2 className={s.heading} {...heading}>
          Verify another way
        </h2>
        <p className={s.lead}>
          Connecting your bank is fastest. These work too, but some need a person to review them, so they
          take longer.
        </p>
      </div>
      <fieldset className={own.options}>
        <legend className={own.srOnly}>Other ways to verify</legend>
        {manualOptions.map((m) => (
          <label key={m.id} className={own.option}>
            <input
              type="radio"
              name="manual"
              className={own.radio}
              checked={props.choice === m.id}
              onChange={() => props.onPick(m.id)}
            />
            <span className={own.optionText}>
              <span className={own.optionTitle}>{m.title}</span>
              <span className={own.optionDesc}>{m.desc}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {selected && (
        <p className={own.manualNote} role="status">
          {selected.note}
        </p>
      )}
      <Button variant="secondary" fullWidth onClick={props.onConnect}>
        Connect my bank instead
      </Button>
    </div>
  );
}

// ---- bank ------------------------------------------------------------------

export function BankStep(props: {
  institutions: Institution[];
  query: string;
  error: string | null;
  profiles: SampleProfileSummary[] | null;
  profileId: string | null;
  onQuery: (q: string) => void;
  onProfile: (id: string) => void;
  onPick: (institution: Institution) => void;
}) {
  const q = props.query.trim().toLowerCase();
  const shown = props.institutions.filter((i) => i.kind === 'other' || !q || i.name.toLowerCase().includes(q));
  return (
    <div className={s.screen}>
      <div className={s.intro}>
        <h2 className={s.heading} {...heading}>
          Choose your bank
        </h2>
        <p className={s.lead}>You’ll sign in on your bank’s own page. We never see your password.</p>
      </div>
      {props.error && (
        <p className={s.alert} role="alert">
          {props.error}
        </p>
      )}
      {props.profiles && (
        <fieldset className={own.demoProfiles}>
          <legend className={own.demoLegend}>Demo: which sample data should the bank return?</legend>
          <div className={own.demoChoices}>
            {props.profiles.map((p) => (
              <label key={p.id} className={own.demoChoice}>
                <input
                  type="radio"
                  name="profile"
                  checked={props.profileId === p.id}
                  onChange={() => props.onProfile(p.id)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <input
        type="search"
        className={s.input}
        aria-label="Search banks"
        placeholder={props.institutions
          .filter((i) => i.kind === 'bank')
          .slice(0, 3)
          .map((i) => i.name)
          .join(', ')}
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
      />
      <ul className={own.banks}>
        {shown.map((i) => (
          <li key={i.id}>
            <button type="button" className={own.bank} onClick={() => props.onPick(i)}>
              <span className={own.bankName}>
                <span className={own.bankIcon}>
                  <BankIcon size={18} />
                </span>
                {i.name}
              </span>
              <span className={s.iconMuted}>
                <ChevronRightIcon size={18} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- connecting ------------------------------------------------------------

export function ConnectingStep(props: { bankName: string; historyMonths: number }) {
  return (
    <div className={own.connecting} role="status" aria-live="polite">
      <div className={s.intro}>
        <h2 className={s.heading} {...heading}>
          Connecting to {props.bankName}
        </h2>
        <p className={s.lead}>Reading {props.historyMonths} months of activity. This takes a few seconds.</p>
      </div>
      <div className={own.bar}>
        <div className={own.barFill} />
      </div>
      <div className={own.reading}>
        <span>Pay deposits</span>
        <span>Rent and recurring bills</span>
        <span>Balance history</span>
      </div>
    </div>
  );
}
