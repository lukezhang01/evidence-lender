// Borrower application form state. Pure: no I/O here. The component reads the
// file and calls the Server Action, and reports results back as events. The
// only evidence in scope is an uploaded CSV statement.
import type { FieldErrors } from '@evidence-lender/backend/contract';

export type Field = 'requestedAmount' | 'legalName' | 'email';

export interface FormState {
  values: Record<Field, string>;
  file: { fileName: string; csv: string } | null;
  errors: FieldErrors; // keyed by Field, or 'statement'
  formError: string | null; // a problem no single field explains
  applicationId: string | null; // the draft from an earlier try
  submitting: boolean;
}

export type FormEvent =
  | { type: 'edit'; field: Field; value: string }
  | { type: 'file_chosen'; fileName: string; csv: string }
  | { type: 'file_rejected'; message: string }
  | { type: 'invalid'; errors: FieldErrors }
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string; fields: FieldErrors; applicationId: string | null };

export const initialFormState: FormState = {
  values: { requestedAmount: '', legalName: '', email: '' },
  file: null,
  errors: {},
  formError: null,
  applicationId: null,
  submitting: false,
};

// Whole amounts only; "$4,000" and "4000" both read as 4000.
export function parseAmount(value: string): number | null {
  const digits = value.replace(/[$,\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The same checks the backend makes, so most mistakes show before anything is sent.
export function validate(state: FormState, amount: { min: number; max: number; message: string }): FieldErrors {
  const errors: FieldErrors = {};
  const n = parseAmount(state.values.requestedAmount);
  if (n === null || n < amount.min || n > amount.max) errors.requestedAmount = amount.message;
  if (!state.values.legalName.trim()) errors.legalName = 'Enter your full legal name.';
  if (!EMAIL.test(state.values.email.trim())) errors.email = 'Enter your email address, like name@example.com.';
  if (!state.file) errors.statement = 'Choose your bank statement, saved as a CSV file.';
  return errors;
}

export function flowReducer(state: FormState, event: FormEvent): FormState {
  switch (event.type) {
    case 'edit':
      if (state.submitting) return state;
      return {
        ...state,
        values: { ...state.values, [event.field]: event.value },
        errors: { ...state.errors, [event.field]: undefined },
      };
    case 'file_chosen':
      if (state.submitting) return state;
      return {
        ...state,
        file: { fileName: event.fileName, csv: event.csv },
        errors: { ...state.errors, statement: undefined },
      };
    case 'file_rejected':
      if (state.submitting) return state;
      return { ...state, file: null, errors: { ...state.errors, statement: event.message } };
    case 'invalid':
      return { ...state, errors: event.errors, formError: null };
    case 'submit_started':
      return state.submitting ? state : { ...state, submitting: true, errors: {}, formError: null };
    case 'submit_failed':
      return {
        ...state,
        submitting: false,
        errors: event.fields,
        formError: Object.keys(event.fields).length ? null : event.message,
        applicationId: event.applicationId ?? state.applicationId,
      };
  }
}
