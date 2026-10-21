import { Button } from '@/components/ui/Button';
import styles from './StartScreen.module.css';

interface StartScreenProps {
  amounts: { value: number; label: string }[];
  selectedAmount: number;
}

const steps = [
  { title: 'Tell us who you are', body: 'Three fields, about a minute' },
  { title: 'Connect your bank', body: 'Read-only. It replaces pay stubs and statements.' },
  { title: 'Check what we found, then get a decision', body: 'You see our numbers before anyone else does.' },
];

// Static for now. Selecting an amount and "Get started" are wired to the
// borrower state machine in build order step 2.
export function StartScreen({ amounts, selectedAmount }: StartScreenProps) {
  return (
    <div className={styles.screen}>
      <div className={styles.intro}>
        <h1 className={styles.title}>A loan based on how you handle money today</h1>
        <p className={styles.lead}>
          New to Canada, or rebuilding after a hard year? We look at your income and the bills you
          already pay on time, not just a credit score.
        </p>
      </div>

      <div className={styles.amountGroup} role="group" aria-labelledby="amount-label">
        <span id="amount-label" className={styles.groupLabel}>
          How much do you need?
        </span>
        <div className={styles.amounts}>
          {amounts.map((a) => (
            <button
              key={a.value}
              type="button"
              className={styles.amount}
              aria-pressed={a.value === selectedAmount}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.how}>
        <span className={styles.howLabel}>How it works</span>
        <ol className={styles.howList}>
          {steps.map((step, i) => (
            <li key={step.title} className={styles.howStep}>
              <span className={styles.howNumber} aria-hidden="true">
                {i + 1}
              </span>
              <span className={styles.howText}>
                <span className={styles.howTitle}>{step.title}</span>
                <span className={styles.howBody}>{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Button fullWidth>Get started</Button>
      <p className={styles.footnote}>You don’t need a credit score to apply.</p>
    </div>
  );
}
