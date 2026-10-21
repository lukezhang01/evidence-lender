import type { BlindSpot } from '@evidence-lender/backend/contract';
import { Badge } from '@/components/ui/Badge';
import { QuestionIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

// Always shown (rule 3).
export function BlindSpots({ blindSpots }: { blindSpots: BlindSpot[] }) {
  return (
    <section className={e.card} aria-labelledby="blind-spots">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="blind-spots" className={e.title}>
            Blind spots
          </h2>
          <span className={e.question}>What this evidence can’t tell you. Weigh it before you decide.</span>
        </div>
        <Badge tone="neutral">Not visible to us</Badge>
      </div>
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
