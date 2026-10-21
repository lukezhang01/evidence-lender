import s from './borrower.module.css';

const TOTAL = 4;
const labels = ['', 'About you', 'Connect your bank', 'Check what we found', 'Decision'];

export function Progress({ current }: { current: number }) {
  return (
    <div className={s.progress}>
      <div
        className={s.segments}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TOTAL}
        aria-valuenow={current}
        aria-label="Application progress"
      >
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} className={i < current ? s.segmentDone : s.segment} />
        ))}
      </div>
      <span className={s.progressLabel}>
        Step {current} of {TOTAL} · {labels[current]}
      </span>
    </div>
  );
}
