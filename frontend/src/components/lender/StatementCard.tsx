import { Badge } from '@/components/ui/Badge';
import { FileIcon, WarningIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

interface StatementCardProps {
  line: string; // file name, transaction count, date range
  uploaded: string;
  fileHash: { short: string; full: string };
}

// The file every fact came from. It isn't verified at source, so it never
// feeds a suggestion (rule 2) and a person decides.
export function StatementCard({ line, uploaded, fileHash }: StatementCardProps) {
  return (
    <section className={e.cardWarn} aria-labelledby="uploaded-statement">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="uploaded-statement" className={e.title}>
            Uploaded statement
          </h2>
          <span className={e.question}>The only evidence in this application.</span>
        </div>
        <Badge tone="warn">
          <WarningIcon size={14} />
          Not verified
        </Badge>
      </div>
      <div className={e.item}>
        <span className={e.iconWarn}>
          <FileIcon size={20} />
        </span>
        <span className={e.text}>
          <span className={e.statement}>{line}</span>
          <span className={e.explain}>
            The applicant uploaded this file. It can’t be traced back to their bank, so every fact above is marked not
            verified and no suggestion is made from it. Read the facts and decide.
          </span>
          <span className={e.provenance}>
            Uploaded by applicant · {uploaded} · <span title={fileHash.full}>file sha256 {fileHash.short}</span>
          </span>
        </span>
      </div>
    </section>
  );
}
