'use client';

import type { Applicant, SampleStatementSummary } from '@evidence-lender/backend/contract';
import Link from 'next/link';
import { startTransition, useEffect, useReducer, useRef } from 'react';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { submitApplicationAction, uploadSampleStatementAction, uploadStatementAction } from '@/lib/actions';
import { BorrowerCard, BorrowerFooter } from './BorrowerShell';
import { FoundStep } from './FoundStep';
import { Progress } from './Progress';
import { StatementStep } from './StatementStep';
import { AboutStep, StartStep } from './steps';
import { backTo, flowReducer, initialFlowState, progressOf, type FlowState } from './flow';
import s from './borrower.module.css';

interface BorrowerFlowProps {
  amounts: { value: number; label: string }[];
  defaultAmount: number;
  minimumStatementMonths: number;
  sampleData: boolean;
  sampleApplicant: Applicant | null;
  sampleStatements: SampleStatementSummary[] | null;
}

// Keeps well under the Server Action body limit; a year of transactions is far smaller.
const MAX_STATEMENT_BYTES = 512 * 1024;
const UNREACHABLE = 'We couldn’t reach the server. Check your connection and try again.';

export function BorrowerFlow(props: BorrowerFlowProps) {
  const initial = (): FlowState =>
    initialFlowState({
      amount: props.defaultAmount,
      applicant: props.sampleApplicant ?? { legalName: '', email: '', phone: '' },
    });
  const [state, dispatch] = useReducer(flowReducer, undefined, initial);
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

  const statementInput = () => ({
    applicationId: state.applicationId,
    applicant: state.applicant,
    requestedAmount: state.amount,
  });

  async function upload(send: () => ReturnType<typeof uploadStatementAction>) {
    dispatch({ type: 'upload_started' });
    const result = await send().catch(() => null);
    if (result?.ok) dispatch({ type: 'uploaded', applicationId: result.data.applicationId, found: result.data.found });
    else dispatch({ type: 'upload_failed', message: result?.message ?? UNREACHABLE, applicationId: result?.applicationId });
  }

  async function uploadFile(file: File) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      dispatch({ type: 'upload_failed', message: 'PDF statements aren’t supported yet. Download your transactions as a CSV file instead.' });
      return;
    }
    if (file.size > MAX_STATEMENT_BYTES) {
      dispatch({ type: 'upload_failed', message: 'That file is too large. Export a shorter period, like the last 6 months.' });
      return;
    }
    const csv = await file.text();
    await upload(() => uploadStatementAction(statementInput(), { fileName: file.name, csv }));
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
      <BorrowerCard ref={card}>
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
        {step === 'statement' && (
          <StatementStep
            minimumMonths={props.minimumStatementMonths}
            uploading={state.uploading}
            error={state.uploadError}
            samples={props.sampleStatements}
            onFile={uploadFile}
            onSample={(id) => upload(() => uploadSampleStatementAction(statementInput(), id))}
          />
        )}
        {step === 'found' && state.found && (
          <FoundStep
            found={state.found}
            noteOpen={state.noteOpen}
            borrowerNote={state.borrowerNote}
            submitting={state.submitting}
            submitError={state.submitError}
            onReplace={() => dispatch({ type: 'back' })}
            onToggleNote={() => dispatch({ type: 'toggle_note' })}
            onEditNote={(value) => dispatch({ type: 'edit_note', value })}
            onSubmit={submit}
          />
        )}
      </BorrowerCard>

      {props.sampleData && (
        <BorrowerFooter>
          <Link href="/review">Open the lender review screen</Link>
          <button type="button" onClick={() => dispatch({ type: 'restart', state: initial() })}>
            Restart demo
          </button>
        </BorrowerFooter>
      )}
    </>
  );
}
