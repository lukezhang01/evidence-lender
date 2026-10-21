import type { Application, EvidenceRecord } from '@evidence-lender/backend/contract';
import { Badge } from '@/components/ui/Badge';
import { LockIcon } from '@/components/ui/icons';
import { provenanceLine, shortHash, summarizeRecord } from '@/lib/evidence';
import type { Formatters } from '@/lib/format';
import { applicationStatus, flagLabel } from '@/lib/labels';
import { Card } from './Card';
import styles from './ApplicationHeader.module.css';

interface ApplicationHeaderProps {
  application: Application;
  record: EvidenceRecord | undefined;
  format: Formatters;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ApplicationHeader({ application, record, format }: ApplicationHeaderProps) {
  const status = applicationStatus[application.status];

  // A chip is a claim, so it only shows when the fact behind it is in the record.
  const chips = application.flags.flatMap((flag) => {
    const item = record?.items.find((i) => i.id === flag.evidenceItemId);
    if (!item) return [];
    const { label, tone } = flagLabel[flag.code];
    return [
      <Badge key={flag.code} tone={tone} title={provenanceLine(item, format)}>
        {label}
      </Badge>,
    ];
  });

  return (
    <Card labelledBy="applicant-name">
      <div className={styles.top}>
        <div className={styles.identity}>
          <h1 id="applicant-name" className={styles.name}>
            {application.applicant.legalName}
          </h1>
          <span className={styles.meta}>
            Application {application.id} · requested {format.wholeMoney(application.requestedAmount)} ·
            submitted {format.dateTime(application.submittedAt)}
          </span>
        </div>
        {chips.length > 0 && <div className={styles.chips}>{chips}</div>}
      </div>

      {record ? (
        <div className={styles.record}>
          <span className={styles.recordId}>
            <LockIcon size={14} />
            Evidence record {record.id}
          </span>
          <RecordCounts record={record} />
          <span>Sealed {format.dateTime(record.sealedAt)}</span>
          <span title={record.sha256}>sha256 {shortHash(record.sha256)}</span>
        </div>
      ) : (
        <div className={styles.record}>No evidence record yet</div>
      )}

      {status.note && (
        <div className={styles.status}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <p className={styles.statusNote}>{status.note}</p>
        </div>
      )}
    </Card>
  );
}

function RecordCounts({ record }: { record: EvidenceRecord }) {
  const { factCount, sourceCount } = summarizeRecord(record);
  return (
    <span>
      {count(factCount, 'fact', 'facts')} · {count(sourceCount, 'source', 'sources')}
    </span>
  );
}
