import { Badge } from '@/components/ui/Badge';
import { LockIcon } from '@/components/ui/icons';
import d from './Decision.module.css';

interface DecisionLoggedProps {
  title: string;
  rows: { label: string; value: string }[];
}

// Logged decisions are append-only (rule 6): there is no undo here.
export function DecisionLogged({ title, rows }: DecisionLoggedProps) {
  return (
    <section className={d.panel} aria-labelledby="decision-logged">
      <span className={d.badge}>
        <Badge tone="ok">
          <LockIcon size={14} />
          Decision logged
        </Badge>
      </span>
      <h2 id="decision-logged" className={d.title}>
        {title}
      </h2>
      <dl className={d.rows}>
        {rows.map((r) => (
          <div key={r.label} className={d.row}>
            <dt className={d.loggedLabel}>{r.label}</dt>
            <dd className={d.loggedValue}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <span className={d.caption}>Logged decisions can’t be edited. A correction is logged as a new entry.</span>
    </section>
  );
}
