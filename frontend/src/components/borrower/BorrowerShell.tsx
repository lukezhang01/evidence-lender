import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { BrandMark } from '@/components/ui/BrandMark';
import styles from './BorrowerShell.module.css';

interface BorrowerShellProps {
  brandName: string;
  sampleData: boolean;
  children: React.ReactNode;
}

export function BorrowerShell({ brandName, sampleData, children }: BorrowerShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <header className={styles.top}>
          <BrandMark name={brandName} />
          {sampleData && <Badge tone="demo">Demo · sample data</Badge>}
        </header>
        <main className={styles.card}>{children}</main>
        {sampleData && (
          <footer className={styles.footer}>
            <Link href="/review">Open the lender review screen</Link>
          </footer>
        )}
      </div>
    </div>
  );
}
