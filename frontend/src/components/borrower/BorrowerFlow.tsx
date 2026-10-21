'use client';

import type { Applicant, Institution, SampleProfileSummary } from '@evidence-lender/backend/contract';
import Link from 'next/link';
import { startTransition, useEffect, useReducer, useRef } from 'react';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { addUploadAction, connectBankAction, submitApplicationAction } from '@/lib/actions';
import { BorrowerCard, BorrowerFooter } from './BorrowerShell';
import { FoundStep } from './FoundStep';
import { Progress } from './Progress';
import { AboutStep, BankStep, ConnectingStep, ConsentStep, ManualStep, StartStep } from './steps';
import { backTo, flowReducer, initialFlowState, progressOf, type FlowState } from './flow';
import s from './borrower.module.css';

interface BorrowerFlowProps {
  amounts: { value: number; label: string }[];
  defaultAmount: number;
  historyMonths: number;
  institutions: Institution[];
  sampleData: boolean;
  sampleApplicant: Applicant | null;
  profiles: SampleProfileSummary[] | null;
}

const UNREACHABLE = 'We couldn’t reach the server. Check your connection and try again.';

export function BorrowerFlow(props: BorrowerFlowProps) {
  const initial = (): FlowState =>
    initialFlowState({
      amount: props.defaultAmount,
      applicant: props.sampleApplicant ?? { legalName: '', email: '', phone: '' },
      profileId: props.profiles?.[0]?.id ?? null,
    });
  const [state, dispatch] = useReducer(flowReducer, undefined, initial);
  const [run, restart] = useReducer((n: number) => n + 1, 0);
  const card = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to each new step's heading, so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    card.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
  }, [state.step]);

  async function pickBank(institution: Institution) {
    const chosen = { id: institution.id, name: institution.kind === 'other' ? null : institution.name };
    dispatch({ type: 'pick_bank', institution: chosen });
    const result = await connectBankAction({
      applicationId: state.applicationId,
      applicant: state.applicant,
      requestedAmount: state.amount,
      institutionId: institution.id,
      profileId: state.profileId,
    }).catch(() => null);
    if (result?.ok) dispatch({ type: 'connected', applicationId: result.data.applicationId, found: result.data.found });
    else dispatch({ type: 'connect_failed', message: result?.message ?? UNREACHABLE });
  }

  async function upload(file: File) {
    if (!state.applicationId) return;
    dispatch({ type: 'upload_started' });
    const result = await addUploadAction(state.applicationId, { name: file.name, type: file.type, size: file.size }).catch(
      () => null,
    );
    if (result?.ok) dispatch({ type: 'uploaded', found: result.data });
    else dispatch({ type: 'upload_failed', message: result?.message ?? UNREACHABLE });
  }

  function submit() {
    const id = state.applicationId;
    if (!id || state.submitting) return;
    dispatch({ type: 'submit_started' });
    startTransition(async () => {
      // On success the action redirects to the decision page.
      const result = await submitApplicationAction(id, {
        applicant: state.applicant,
        requestedAmount: state.amount,
        borrowerNote: state.borrowerNote,
      });
      if (!result.ok) dispatch({ type: 'submit_failed', message: result.message });
    });
  }

  const step = state.step;
  const progress = progressOf[step];
  const canGoBack = !!backTo[step];

  return (
    <>
      <BorrowerCard ref={card} key={run}>
        {(canGoBack || progress > 0) && (
          <div className={s.top}>
            {canGoBack && (
              <button type="button" className={s.back} onClick={() => dispatch({ type: 'back' })}>
                <ArrowLeftIcon />
                Back
              </button>
            )}
            <Progress current={progress} />
          </div>
        )}

        {step === 'start' && (
          <StartStep
            amounts={props.amounts}
            amount={state.amount}
            onPick={(amount) => dispatch({ type: 'pick_amount', amount })}
            onStart={() => dispatch({ type: 'start' })}
          />
        )}
        {step === 'about' && (
          <AboutStep
            applicant={state.applicant}
            nameError={state.nameError}
            onEdit={(field, value) => dispatch({ type: 'edit_applicant', field, value })}
            onContinue={() => dispatch({ type: 'continue_about' })}
          />
        )}
        {step === 'consent' && (
          <ConsentStep
            historyMonths={props.historyMonths}
            onConnect={() => dispatch({ type: 'go_bank' })}
            onManual={() => dispatch({ type: 'go_manual' })}
          />
        )}
        {step === 'manual' && (
          <ManualStep
            choice={state.manualChoice}
            onPick={(choice) => dispatch({ type: 'pick_manual', choice })}
            onConnect={() => dispatch({ type: 'go_bank' })}
          />
        )}
        {step === 'bank' && (
          <BankStep
            institutions={props.institutions}
            query={state.query}
            error={state.connectError}
            profiles={props.profiles}
            profileId={state.profileId}
            onQuery={(query) => dispatch({ type: 'search', query })}
            onProfile={(profileId) => dispatch({ type: 'pick_profile', profileId })}
            onPick={pickBank}
          />
        )}
        {step === 'connecting' && (
          <ConnectingStep bankName={state.institution?.name ?? 'your bank'} historyMonths={props.historyMonths} />
        )}
        {step === 'found' && state.found && (
          <FoundStep
            found={state.found}
            historyMonths={props.historyMonths}
            uploading={state.uploading}
            uploadError={state.uploadError}
            noteOpen={state.noteOpen}
            borrowerNote={state.borrowerNote}
            submitting={state.submitting}
            submitError={state.submitError}
            onUpload={upload}
            onToggleNote={() => dispatch({ type: 'toggle_note' })}
            onEditNote={(value) => dispatch({ type: 'edit_note', value })}
            onSubmit={submit}
          />
        )}
      </BorrowerCard>

      {props.sampleData && (
        <BorrowerFooter>
          <Link href="/review">Open the lender review screen</Link>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'restart', state: initial() });
              restart();
            }}
          >
            Restart demo
          </button>
        </BorrowerFooter>
      )}
    </>
  );
}
