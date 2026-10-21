import { BrandMark } from '@/components/ui/BrandMark';
import styles from './BorrowerShell.module.css';

interface BorrowerShellProps {
  brandName: string;
  children: React.ReactNode;
}

// One centred column, max 520px (docs/HANDOFF.md section 2).
export function BorrowerShell({ brandName, children }: BorrowerShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <header className={styles.top}>
          <BrandMark name={brandName} />
        </header>
        {children}
      </div>
    </div>
  );
}

export function BorrowerCard({ children, ref }: { children: React.ReactNode; ref?: React.Ref<HTMLElement> }) {
  return (
    <main className={styles.card} ref={ref}>
      {children}
    </main>
  );
}

export function BorrowerFooter({ children }: { children: React.ReactNode }) {
  return <footer className={styles.footer}>{children}</footer>;
}
