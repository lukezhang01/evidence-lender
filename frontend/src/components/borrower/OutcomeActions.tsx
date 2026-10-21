'use client';

import type { BorrowerRequest } from '@evidence-lender/backend/contract';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { CheckIcon } from '@/components/ui/icons';
import { borrowerRequestAction } from '@/lib/actions';
import s from './borrower.module.css';

interface OutcomeActionsProps {
  applicationId: string;
  kind: 'approved' | 'declined';
  done: Partial<Record<BorrowerRequest['kind'], string>>; // confirmation text per completed request
  recheckLabel: string;
}

export function OutcomeActions({ applicationId, kind, done, recheckLabel }: OutcomeActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send(request: BorrowerRequest['kind']) {
    setError(null);
    startTransition(async () => {
      const result = await borrowerRequestAction(applicationId, request).catch(() => null);
      if (!result?.ok) setError(result?.message ?? 'We couldn’t send that. Try again.');
    });
  }

  const [primary, secondary]: [BorrowerRequest['kind'], BorrowerRequest['kind']] =
    kind === 'approved' ? ['accept_offer', 'talk_first'] : ['recheck', 'human_review'];
  const labels: Record<BorrowerRequest['kind'], string> = {
    accept_offer: 'Accept offer',
    talk_first: 'Talk to someone first',
    recheck: recheckLabel,
    human_review: 'Ask a person to review',
  };
  const confirmations = [primary, secondary].flatMap((k) => (done[k] ? [done[k]] : []));

  return (
    <div className={s.actionsLoose}>
      {confirmations.map((text) => (
        <div key={text} className={s.confirm} role="status">
          <span className={s.iconInherit}>
            <CheckIcon size={18} />
          </span>
          <span>{text}</span>
        </div>
      ))}
      {error && (
        <p className={s.alert} role="alert">
          {error}
        </p>
      )}
      {!done[primary] && (
        <Button fullWidth disabled={pending} onClick={() => send(primary)}>
          {labels[primary]}
        </Button>
      )}
      {!done[primary] && !done[secondary] && (
        <Button fullWidth variant="secondary" disabled={pending} onClick={() => send(secondary)}>
          {labels[secondary]}
        </Button>
      )}
    </div>
  );
}
