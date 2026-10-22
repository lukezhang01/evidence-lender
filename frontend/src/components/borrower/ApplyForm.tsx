'use client';

import type { FieldErrors } from '@evidence-lender/backend/contract';
import { startTransition, useReducer, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { FileIcon } from '@/components/ui/icons';
import { applyAction } from '@/lib/actions';
import { BorrowerCard } from './BorrowerShell';
import { type Field, flowReducer, initialFormState, parseAmount, validate } from './flow';
import s from './borrower.module.css';
import own from './ApplyForm.module.css';

interface ApplyFormProps {
  amountRange: { min: number; max: number; label: string }; // label reads like "$500 to $6,000"
  minimumStatementMonths: number;
}

// Keeps well under the Server Action body limit; a year of transactions is far smaller.
const MAX_STATEMENT_BYTES = 512 * 1024;

// Where focus goes for each error, in the order the fields appear.
const inputIds: Record<Field | 'statement', string> = {
  requestedAmount: 'f-amount',
  legalName: 'f-name',
  email: 'f-email',
  statement: 'f-statement',
};

export function ApplyForm({ amountRange, minimumStatementMonths }: ApplyFormProps) {
  const [state, dispatch] = useReducer(flowReducer, initialFormState);
  const fileInput = useRef<HTMLInputElement>(null);
  const { errors } = state;

  function focusFirstError(found: FieldErrors) {
    const first = Object.entries(inputIds).find(([key]) => found[key]);
    if (first) document.getElementById(first[1])?.focus();
  }

  async function chooseFile(file: File) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      dispatch({ type: 'file_rejected', message: 'PDF statements aren’t supported yet. Download your transactions as a CSV file instead.' });
      return;
    }
    if (file.size > MAX_STATEMENT_BYTES) {
      dispatch({ type: 'file_rejected', message: 'That file is too large. Export a shorter period, like the last 6 months.' });
      return;
    }
    dispatch({ type: 'file_chosen', fileName: file.name, csv: await file.text() });
  }

  function submit() {
    if (state.submitting) return;
    const found = validate(state, { ...amountRange, message: `Enter a whole amount from ${amountRange.label}.` });
    const requestedAmount = parseAmount(state.values.requestedAmount);
    if (Object.keys(found).length || requestedAmount === null || !state.file) {
      dispatch({ type: 'invalid', errors: found });
      focusFirstError(found);
      return;
    }
    const input = {
      applicationId: state.applicationId,
      applicant: { legalName: state.values.legalName, email: state.values.email },
      requestedAmount,
      file: state.file,
    };
    dispatch({ type: 'submit_started' });
    startTransition(async () => {
      // On success the action redirects to the decision page.
      const result = await applyAction(input);
      if (result?.ok === false) {
        dispatch({ type: 'submit_failed', ...result });
        focusFirstError(result.fields);
      }
    });
  }

  const fieldError = (key: Field | 'statement') =>
    errors[key] ? (
      <span id={`err-${key}`} className={s.fieldError}>
        {errors[key]}
      </span>
    ) : null;
  const textInput = (field: Field, hintId?: string) => {
    const described = [hintId, errors[field] && `err-${field}`].filter(Boolean).join(' ');
    return {
      id: inputIds[field],
      className: s.input,
      value: state.values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => dispatch({ type: 'edit', field, value: e.target.value }),
      'aria-invalid': errors[field] ? true : undefined,
      'aria-describedby': described || undefined,
    };
  };

  return (
    <BorrowerCard>
      <form
        className={s.screen}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className={s.intro}>
          <h1 className={s.title}>Apply for a loan</h1>
          <p className={s.lead}>
            Upload a bank statement and we’ll show you a credit score and an interest rate. A person reviews every
            application.
          </p>
        </div>

        <div className={s.field}>
          <label htmlFor={inputIds.requestedAmount} className={s.label}>
            How much do you want to borrow?
          </label>
          <span id="amount-hint" className={s.caption}>
            {amountRange.label}
          </span>
          <input type="text" inputMode="numeric" autoComplete="off" {...textInput('requestedAmount', 'amount-hint')} />
          {fieldError('requestedAmount')}
        </div>

        <div className={s.field}>
          <label htmlFor={inputIds.legalName} className={s.label}>
            Full legal name
          </label>
          <input type="text" autoComplete="name" {...textInput('legalName')} />
          {fieldError('legalName')}
        </div>

        <div className={s.field}>
          <label htmlFor={inputIds.email} className={s.label}>
            Email
          </label>
          <input type="email" autoComplete="email" {...textInput('email')} />
          {fieldError('email')}
        </div>

        <div className={s.field}>
          <span id="statement-label" className={s.label}>
            Bank statement
          </span>
          <div id="statement-help" className={own.help}>
            <p>
              Download your transactions from online banking as a CSV file covering at least {minimumStatementMonths}{' '}
              months. It needs these columns:
            </p>
            <ul className={own.columns}>
              <li>Date, like 2026-03-27</li>
              <li>Amount, with money in positive and money out negative (Debit and Credit columns work too)</li>
              <li>Balance, which we need for your credit score</li>
              <li>Description, if your bank includes it</li>
            </ul>
          </div>
          {state.file && (
            <span className={own.file}>
              <FileIcon size={16} />
              {state.file.fileName}
            </span>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className={own.fileInput}
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void chooseFile(file);
            }}
          />
          <button
            type="button"
            id={inputIds.statement}
            className={s.smallButton}
            aria-labelledby={`statement-label ${inputIds.statement}`}
            aria-describedby={errors.statement ? 'err-statement statement-help' : 'statement-help'}
            onClick={() => fileInput.current?.click()}
          >
            {state.file ? 'Choose a different file' : 'Choose a CSV file'}
          </button>
          {fieldError('statement')}
        </div>

        {state.formError && (
          <p className={s.alert} role="alert">
            {state.formError}
          </p>
        )}
        <Button type="submit" fullWidth disabled={state.submitting} aria-busy={state.submitting}>
          {state.submitting ? 'Submitting…' : 'Submit application'}
        </Button>
      </form>
    </BorrowerCard>
  );
}
