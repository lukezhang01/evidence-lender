import type { Reviewer } from '@evidence-lender/backend/contract';
import { BrandMark } from '@/components/ui/BrandMark';
import styles from './LenderShell.module.css';

interface LenderShellProps {
  brandName: string;
  reviewer: Reviewer;
  queue: React.ReactNode;
  children: React.ReactNode;
}

export function LenderShell({ brandName, reviewer, queue, children }: LenderShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.left}>
          <BrandMark name={brandName} />
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.section}>Review queue</span>
        </div>
        <div className={styles.right}>
          <span className={styles.avatar} role="img" aria-label={`Signed in as ${reviewer.name}`} title={reviewer.name}>
            {reviewer.initials}
          </span>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.queue}>{queue}</aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
