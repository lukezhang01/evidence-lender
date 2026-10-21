// Borrower application flow as an explicit state machine (docs/HANDOFF.md
// section 4). Pure: no I/O here. The component runs side effects (connecting,
// uploading, submitting) and reports results back as events.
import type { Applicant } from '@evidence-lender/backend/contract';
import type { FoundView } from '@/lib/views';

export type Step = 'start' | 'about' | 'consent' | 'manual' | 'bank' | 'connecting' | 'found';
export type ManualChoice = 'payroll' | 'upload' | 'employer';

export interface FlowState {
  step: Step;
  amount: number;
  applicant: Applicant;
  nameError: boolean;
  manualChoice: ManualChoice | null;
  query: string;
  profileId: string | null;
  institution: { id: string; name: string | null } | null;
  applicationId: string | null;
  found: FoundView | null;
  connectError: string | null;
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
  | { type: 'go_bank' }
  | { type: 'go_manual' }
  | { type: 'pick_manual'; choice: ManualChoice }
  | { type: 'search'; query: string }
  | { type: 'pick_profile'; profileId: string }
  | { type: 'pick_bank'; institution: { id: string; name: string | null } }
  | { type: 'connected'; applicationId: string; found: FoundView }
  | { type: 'connect_failed'; message: string }
  | { type: 'upload_started' }
  | { type: 'uploaded'; found: FoundView }
  | { type: 'upload_failed'; message: string }
  | { type: 'toggle_note' }
  | { type: 'edit_note'; value: string }
  | { type: 'submit_started' }
  | { type: 'submit_failed'; message: string }
  | { type: 'back' }
  | { type: 'restart'; state: FlowState };

// Where Back goes from each step. Steps not listed have no Back.
export const backTo: Partial<Record<Step, Step>> = {
  about: 'start',
  consent: 'about',
  manual: 'consent',
  bank: 'consent',
  found: 'bank',
};

// Progress bar position, out of 4 (the decision is step 4, on its own page).
export const progressOf: Record<Step, number> = {
  start: 0,
  about: 1,
  consent: 2,
  manual: 2,
  bank: 2,
  connecting: 2,
  found: 3,
};

export function initialFlowState(input: { amount: number; applicant: Applicant; profileId: string | null }): FlowState {
  return {
    step: 'start',
    amount: input.amount,
    applicant: input.applicant,
    nameError: false,
    manualChoice: null,
    query: '',
    profileId: input.profileId,
    institution: null,
    applicationId: null,
    found: null,
    connectError: null,
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
      return { ...state, step: 'consent' };
    case 'go_bank':
      return state.step === 'consent' || state.step === 'manual' ? { ...state, step: 'bank', connectError: null } : state;
    case 'go_manual':
      return state.step === 'consent' ? { ...state, step: 'manual' } : state;
    case 'pick_manual':
      return state.step === 'manual' ? { ...state, manualChoice: event.choice } : state;
    case 'search':
      return { ...state, query: event.query };
    case 'pick_profile':
      return { ...state, profileId: event.profileId };
    case 'pick_bank':
      if (state.step !== 'bank') return state;
      return { ...state, step: 'connecting', institution: event.institution, connectError: null };
    case 'connected':
      if (state.step !== 'connecting') return state;
      return { ...state, step: 'found', applicationId: event.applicationId, found: event.found };
    case 'connect_failed':
      if (state.step !== 'connecting') return state;
      return { ...state, step: 'bank', connectError: event.message };
    case 'upload_started':
      return { ...state, uploading: true, uploadError: null };
    case 'uploaded':
      return { ...state, uploading: false, found: event.found };
    case 'upload_failed':
      return { ...state, uploading: false, uploadError: event.message };
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
      return target && !state.submitting ? { ...state, step: target } : state;
    }
    case 'restart':
      return event.state;
  }
}
