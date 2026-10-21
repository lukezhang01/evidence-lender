'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './error.module.css';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>This page didn’t load</h1>
        <p className={styles.body}>We couldn’t get the data for this page. Nothing was submitted or changed.</p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </main>
  );
}
