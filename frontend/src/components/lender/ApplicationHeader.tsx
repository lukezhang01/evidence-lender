import type { Application } from '@evidence-lender/backend/contract';
import type { Formatters } from '@/lib/format';
import { Card } from './Card';
import styles from './ApplicationHeader.module.css';

interface ApplicationHeaderProps {
  application: Application;
  format: Formatters;
}

export function ApplicationHeader({ application, format }: ApplicationHeaderProps) {
  return (
    <Card labelledBy="applicant-name">
      <div className={styles.top}>
        <div className={styles.identity}>
          <h1 id="applicant-name" className={styles.name}>
            {application.applicant.legalName}
          </h1>
          <span className={styles.meta}>{application.applicant.email}</span>
          <span className={styles.meta}>
            Application {application.id}
            {application.submittedAt && ` · submitted ${format.dateTime(application.submittedAt)}`}
          </span>
        </div>
        <div className={styles.amount}>
          <span className={styles.amountValue}>{format.wholeMoney(application.requestedAmount)}</span>
          <span className={styles.meta}>requested</span>
        </div>
      </div>
    </Card>
  );
}
