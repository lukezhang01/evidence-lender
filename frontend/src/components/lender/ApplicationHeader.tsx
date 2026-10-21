import type { Application, EvidenceRecord } from '@evidence-lender/backend/contract';
import { LockIcon } from '@/components/ui/icons';
import { countLabel, shortHash, summarizeRecord } from '@/lib/evidence';
import type { Formatters } from '@/lib/format';
import { Card } from './Card';
import styles from './ApplicationHeader.module.css';

interface ApplicationHeaderProps {
  application: Application;
  record: EvidenceRecord;
  format: Formatters;
}

export function ApplicationHeader({ application, record, format }: ApplicationHeaderProps) {
  const { factCount, sourceCount } = summarizeRecord(record);
  return (
    <Card labelledBy="applicant-name">
      <div className={styles.identity}>
        <h1 id="applicant-name" className={styles.name}>
          {application.applicant.legalName}
        </h1>
        <span className={styles.meta}>
          Application {application.id} · requested {format.wholeMoney(application.requestedAmount)}
          {application.submittedAt && ` · submitted ${format.dateTime(application.submittedAt)}`}
        </span>
      </div>

      <div className={styles.record}>
        <span className={styles.recordId}>
          <LockIcon size={14} />
          Evidence record {record.id}
        </span>
        <span>
          {countLabel(factCount, 'fact', 'facts')} · {countLabel(sourceCount, 'source', 'sources')}
        </span>
        <span>Sealed {format.dateTime(record.sealedAt)}</span>
        <span title={record.sha256}>sha256 {shortHash(record.sha256)}</span>
      </div>

      {application.borrowerNote && (
        <div className={styles.borrowerNote}>
          <span className={styles.borrowerNoteLabel}>Applicant’s note · written by the applicant, not verified</span>
          <p className={styles.borrowerNoteText}>{application.borrowerNote}</p>
        </div>
      )}
    </Card>
  );
}
