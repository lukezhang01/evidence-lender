import type { Suggestion } from '@evidence-lender/backend/contract';
import { RequestSourceButton } from './RequestSourceButton';
import d from './Decision.module.css';

interface NoSuggestionProps {
  applicationId: string;
  reason: Suggestion['noneReason'];
  canRequest: boolean;
  requested: boolean;
  modelLine: string;
}

// A queue item with nothing verified gets no suggestion and no decision
// buttons: the reviewer asks for a source connection instead (HANDOFF section 5).
export function NoSuggestion({ applicationId, reason, canRequest, requested, modelLine }: NoSuggestionProps) {
  return (
    <section className={d.panel} aria-labelledby="no-suggestion">
      <div className={d.intro}>
        <span className={d.eyebrow}>Suggested decision</span>
        <h2 id="no-suggestion" className={d.title}>
          No suggestion
        </h2>
        <span className={d.summary}>
          {reason === 'nothing_submitted'
            ? 'Nothing has arrived from the applicant yet, so there’s nothing to suggest or decide.'
            : 'Nothing here is verified at source. Uploaded documents never feed a suggestion, so none is made and no decision can be logged until the applicant connects a bank or payroll account.'}
        </span>
      </div>
      {reason === 'nothing_verified' && canRequest && (
        <RequestSourceButton
          applicationId={applicationId}
          kind="bank_or_payroll"
          label="Ask the applicant to connect a bank or payroll account"
          requested={requested}
        />
      )}
      <span className={d.model}>{modelLine}</span>
    </section>
  );
}
