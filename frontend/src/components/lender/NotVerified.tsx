import { Badge } from '@/components/ui/Badge';
import { FileIcon, WarningIcon } from '@/components/ui/icons';
import { RequestSourceButton } from './RequestSourceButton';
import e from './Evidence.module.css';

interface NotVerifiedProps {
  applicationId: string;
  uploads: { id: string; statement: string; explanation: string; provenance: string }[];
  canRequest: boolean;
  payrollRequested: boolean;
}

// Uploads are shown apart from source data and never feed the suggestion (rule 2).
export function NotVerified({ applicationId, uploads, canRequest, payrollRequested }: NotVerifiedProps) {
  return (
    <section className={e.cardWarn} aria-labelledby="not-verified">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="not-verified" className={e.title}>
            Not verified
          </h2>
          <span className={e.question}>Shown for context. Not used in the suggestion.</span>
        </div>
        <Badge tone="warn">
          <WarningIcon size={14} />
          Uploaded documents
        </Badge>
      </div>
      {uploads.length === 0 ? (
        <p className={e.empty}>No uploaded documents.</p>
      ) : (
        <ul className={e.list}>
          {uploads.map((u) => (
            <li key={u.id} className={e.item}>
              <span className={e.iconWarn}>
                <FileIcon size={20} />
              </span>
              <span className={e.text}>
                <span className={e.statement}>{u.statement}</span>
                <span className={e.explain}>{u.explanation}</span>
                <span className={e.provenance}>{u.provenance}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {uploads.length > 0 && canRequest && (
        <RequestSourceButton
          applicationId={applicationId}
          kind="payroll"
          label="Ask for a payroll connection instead"
          requested={payrollRequested}
        />
      )}
    </section>
  );
}
