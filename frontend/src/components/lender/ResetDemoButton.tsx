'use client';

import { useTransition } from 'react';
import { resetDemoAction } from '@/lib/actions';
import styles from './LenderShell.module.css';

// Sample mode only: puts the backend back to the fixtures, so a demo can be run again.
export function ResetDemoButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className={styles.reset}
      disabled={pending}
      onClick={() => {
        if (window.confirm('Reset all sample data? New applications and logged decisions will be cleared.')) {
          startTransition(() => resetDemoAction());
        }
      }}
    >
      {pending ? 'Resetting…' : 'Reset sample data'}
    </button>
  );
}
