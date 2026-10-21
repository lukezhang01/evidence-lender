// Borrower application flow as an explicit state machine. Pure: no I/O here.
// The component runs side effects (uploading, submitting) and reports results
// back as events. The only evidence in scope is an uploaded CSV statement.
import type { Applicant } from '@evidence-lender/backend/contract';
import type { FoundView } from '@/lib/views';

export type Step = 'start' | 'about' | 'statement' | 'found';

export interface FlowState {
  step: Step;
  amount: number;
  applicant: Applicant;
  nameError: boolean;
  applicationId: string | null;
  found: FoundView | null;
  uploading: boolean;
  uploadError: string | null;
  noteOpen: boolean;
  borrowerNote: string;
  submitting: boolean;
  submitError: string | null;
}

export type FlowEvent =
  | { type: 'pick_amount'; amount: number }
  | { type: 'start' }
  | { type: 'edit_applicant'; field: keyof Applicant; value: string }
  | { type: 'continue_about' }
  | { type: 'upload_started' }
  | { type: 'uploaded'; applicationId: string; found: FoundView }
  | { type: 'upload_failed'; message: string; applicationId?: string | null }
  | { type: 'toggle_note' }
  | { type: 'edit_note'; value: string }
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string }
  | { type: 'back' }
  | { type: 'restart'; state: FlowState };

// Where Back goes from each step. Steps not listed have no Back.
export const backTo: Partial<Record<Step, Step>> = {
  about: 'start',
  statement: 'about',
  found: 'statement',
};

// Progress bar position, out of 4 (the decision is step 4, on its own page).
export const progressOf: Record<Step, number> = {
  start: 0,
  about: 1,
  statement: 2,
  found: 3,
};

export function initialFlowState(input: { amount: number; applicant: Applicant }): FlowState {
  return {
    step: 'start',
    amount: input.amount,
    applicant: input.applicant,
    nameError: false,
    applicationId: null,
    found: null,
    uploading: false,
    uploadError: null,
    noteOpen: false,
    borrowerNote: '',
    submitting: false,
    submitError: null,
  };
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'pick_amount':
      return state.step === 'start' ? { ...state, amount: event.amount } : state;
    case 'start':
      return state.step === 'start' ? { ...state, step: 'about' } : state;
    case 'edit_applicant':
      return {
        ...state,
        applicant: { ...state.applicant, [event.field]: event.value },
        nameError: event.field === 'legalName' ? false : state.nameError,
      };
    case 'continue_about':
      if (state.step !== 'about') return state;
      if (!state.applicant.legalName.trim()) return { ...state, nameError: true };
      return { ...state, step: 'statement' };
    case 'upload_started':
      return state.step === 'statement' && !state.uploading ? { ...state, uploading: true, uploadError: null } : state;
    case 'uploaded':
      if (state.step !== 'statement') return state;
      return { ...state, step: 'found', uploading: false, applicationId: event.applicationId, found: event.found };
    case 'upload_failed':
      return {
        ...state,
        uploading: false,
        uploadError: event.message,
        applicationId: event.applicationId ?? state.applicationId,
      };
    case 'toggle_note':
      return { ...state, noteOpen: !state.noteOpen };
    case 'edit_note':
      return { ...state, borrowerNote: event.value };
    case 'submit_started':
      return state.step === 'found' && !state.submitting ? { ...state, submitting: true, submitError: null } : state;
    case 'submit_failed':
      return { ...state, submitting: false, submitError: event.message };
    case 'back': {
      const target = backTo[state.step];
      return target && !state.submitting && !state.uploading ? { ...state, step: target, uploadError: null } : state;
    }
    case 'restart':
      return event.state;
  }
}
