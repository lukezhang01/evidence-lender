import { Badge } from '@/components/ui/Badge';
import { WarningIcon } from '@/components/ui/icons';
import type { ScoreView } from '@/lib/views';
import e from './Evidence.module.css';
import x from './CreditScore.module.css';

// The course notebook's model, shown first. The applicant sees the same score.
// It isn't a suggestion: the decision panel ignores it and the reviewer still
// writes why. When there's no score, the reason is always shown (rule 3).
export function CreditScoreCard({ view }: { view: ScoreView }) {
  return (
    <section className={e.cardWarn} aria-labelledby="credit-score">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="credit-score" className={e.title}>
            Credit score
          </h2>
          <span className={e.question}>The applicant sees this score too.</span>
        </div>
        <Badge tone="warn">
          <WarningIcon size={14} />
          Experimental model
        </Badge>
      </div>

      <div className={x.scoreRow}>
        <span className={x.score}>{view.status === 'scored' ? view.score : 'None'}</span>
        <span className={x.scoreNote}>
          {view.status === 'scored'
            ? 'From 0 to 1. Higher means the statement looks more like the training loans that weren’t repaid. It isn’t a chance of default.'
            : view.reason}
        </span>
      </div>

      {view.status === 'scored' && (
        <>
          <div className={x.group}>
            <h3 className={x.subhead}>What moved it most</h3>
            <ul className={e.list}>
              {view.movers.map((m) => (
                <li key={m.name} className={x.mover}>
                  <span className={x.moverHead}>
                    <span className={e.statement}>{m.label}</span>
                    <Badge tone="neutral">{m.direction === 'up' ? 'Raised the score' : 'Lowered the score'}</Badge>
                  </span>
                  <span className={x.figures}>
                    This statement {m.value} · typical in training {m.typical}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className={x.group}>
            <h3 className={x.subhead}>How far to trust it</h3>
            <ul className={x.caveats}>
              {view.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </>
      )}
      <span className={e.provenance}>{view.provenance}</span>
    </section>
  );
}
