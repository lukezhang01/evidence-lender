'use client';

import { useId, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ChevronDownIcon, QuestionIcon, WarningIcon } from '@/components/ui/icons';
import type { ExperimentalView } from '@/lib/views';
import e from './Evidence.module.css';
import x from './Experimental.module.css';

// The course notebook's model, for reviewers only. It isn't a suggestion: the
// decision panel ignores it and the reviewer still writes why. The score stays
// closed until asked for, so the facts are read first. When there's no score,
// the reason is always shown (rule 3).
export function ExperimentalScoreCard({ view }: { view: ExperimentalView }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <section className={e.cardWarn} aria-labelledby="experimental-score">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="experimental-score" className={e.title}>
            Experimental score
          </h2>
          <span className={e.question}>
            A course model’s read of this statement. It isn’t a suggestion; read the facts first.
          </span>
        </div>
        <Badge tone="warn">
          <WarningIcon size={14} />
          Experimental · reviewers only
        </Badge>
      </div>

      {view.status === 'not_scored' ? (
        <div className={e.item}>
          <span className={e.iconMuted}>
            <QuestionIcon size={17} />
          </span>
          <span className={e.text}>
            <span className={e.statement}>No score for this statement</span>
            <span className={e.note}>{view.reason}</span>
          </span>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={e.toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide' : 'Show'} the score
            <ChevronDownIcon className={open ? e.chevronOpen : undefined} />
          </button>
          <div id={bodyId} className={x.body} hidden={!open}>
            <div className={x.scoreRow}>
              <span className={x.score}>{view.score}</span>
              <span className={x.scoreNote}>
                On a scale of 0 to 1. Higher means the statement looks more like the training loans that weren’t
                repaid. It isn’t a chance of default.
              </span>
            </div>
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
          </div>
        </>
      )}
      <span className={e.provenance}>{view.provenance}</span>
    </section>
  );
}
