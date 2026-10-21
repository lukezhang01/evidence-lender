import type { Application } from '@evidence-lender/backend/contract';
import type { Formatters } from '@/lib/format';
import { applicationStatus } from '@/lib/labels';
import { QueueList, type QueueItem } from './QueueList';
import styles from './Queue.module.css';

interface QueueProps {
  applications: Application[];
  format: Formatters;
}

export function Queue({ applications, format }: QueueProps) {
  const items: QueueItem[] = applications.map((app) => ({
    id: app.id,
    name: app.applicant.legalName,
    meta: app.statement
      ? `${format.wholeMoney(app.requestedAmount)} · statement to ${format.day(app.statement.lastDate)}`
      : format.wholeMoney(app.requestedAmount),
    statusLabel: applicationStatus[app.status].label,
    tone: applicationStatus[app.status].tone,
  }));
  const readyCount = applications.filter((app) => app.status === 'ready').length;

  return (
    <>
      <div className={styles.heading}>
        <h2 id="queue-heading" className={styles.title}>
          Applications
        </h2>
        <span className={styles.count}>{readyCount} ready</span>
      </div>
      <QueueList items={items} labelledBy="queue-heading" />
      <p className={styles.footnote}>
        Every fact is labelled with where it came from. Uploaded documents never outrank data from
        the source.
      </p>
    </>
  );
}
