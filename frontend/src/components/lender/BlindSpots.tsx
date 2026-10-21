import type { BlindSpot } from '@evidence-lender/backend/contract';
import { QuestionIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

// Always shown (rule 3).
export function BlindSpots({ blindSpots }: { blindSpots: BlindSpot[] }) {
  return (
    <section className={e.card} aria-labelledby="blind-spots">
      <h2 id="blind-spots" className={e.title}>
        What the statement can’t show
      </h2>
      <ul className={e.list}>
        {blindSpots.map((b) => (
          <li key={b.title} className={e.item}>
            <span className={e.iconMuted}>
              <QuestionIcon size={17} />
            </span>
            <span className={e.text}>
              <span className={e.statement}>{b.title}</span>
              <span className={e.note}>{b.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
