'use client';

import type { SourceRequest } from '@evidence-lender/backend/contract';
import { useState, useTransition } from 'react';
import { requestSourceAction } from '@/lib/actions';
import e from './Evidence.module.css';

interface RequestSourceButtonProps {
  applicationId: string;
  kind: SourceRequest['kind'];
  label: string;
  requested: boolean;
}

export function RequestSourceButton({ applicationId, kind, label, requested }: RequestSourceButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (requested) {
    return (
      <span className={e.requested} role="status">
        Request sent to the applicant
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        className={e.requestButton}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await requestSourceAction(applicationId, kind).catch(() => null);
            if (!result?.ok) setError(result?.message ?? 'That didn’t send. Try again.');
          })
        }
      >
        {pending ? 'Sending…' : label}
      </button>
      {error && (
        <span className={e.error} role="alert">
          {error}
        </span>
      )}
    </>
  );
}
