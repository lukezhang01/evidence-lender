'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon, CrossIcon, EyeIcon } from '@/components/ui/icons';
import s from './borrower.module.css';
import own from './steps.module.css';

interface StatementStepProps {
  minimumMonths: number;
  uploading: boolean;
  error: string | null;
  onFile: (file: File) => void;
}

const fileNeeds = [
  'A Date column, like 2026-03-27',
  'An Amount column, with money in as positive and money out as negative. Debit and Credit columns work too, or a Type column that says CREDIT or DEBIT.',
  'A Description column, so we can find your pay, rent and any fees',
  'A Balance column, if your bank includes one',
];

export function StatementStep({ minimumMonths, uploading, error, onFile }: StatementStepProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className={s.screen}>
      <div className={s.intro}>
        <h2 className={s.heading} tabIndex={-1} data-step-heading>
          Upload a bank statement
        </h2>
        <p className={s.lead}>
          Download your transactions from online banking as a CSV file, covering at least {minimumMonths} months,
          and upload it here. It’s how we can say yes without a credit score.
        </p>
      </div>

      <div className={own.consentGrid}>
        <div className={own.canRead}>
          <span className={own.panelTitleAccent}>What we read</span>
          {['Money coming in', 'Rent and bills you pay', 'Your balance over time'].map((t) => (
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
          {['Move money', 'See your bank login', 'Contact your bank'].map((t) => (
            <div key={t} className={s.checkRow}>
              <span className={s.iconMuted}>
                <CrossIcon />
              </span>
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className={own.fileNeeds}>
        <span className={own.panelTitle}>What the file needs</span>
        <ul className={own.needsList}>
          {fileNeeds.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      {error && (
        <p className={s.alert} role="alert">
          {error}
        </p>
      )}

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className={own.fileInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      <div className={s.actions}>
        <Button fullWidth disabled={uploading} aria-busy={uploading} onClick={() => input.current?.click()}>
          {uploading ? 'Reading your statement…' : 'Choose a CSV file'}
        </Button>
      </div>

      <div className={own.note}>
        <span className={s.iconAccent}>
          <EyeIcon size={18} />
        </span>
        <span>You’ll see everything we read before you submit, and you can tell us if something’s wrong.</span>
      </div>
      <p className={s.footnote}>Uploaded statements can’t be traced back to your bank, so a person reviews every application.</p>
    </div>
  );
}
