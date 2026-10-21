import { Badge } from '@/components/ui/Badge';
import { FileIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

interface StatementFactsProps {
  statementLine: string; // file name, transaction count, date range
  facts: { id: string; statement: string; provenance: string }[];
}

// What was read from the uploaded statement, each fact with its source (rule 1).
// Uploads can't be traced back to the bank, so none of it is verified (rule 2).
export function StatementFacts({ statementLine, facts }: StatementFactsProps) {
  return (
    <section className={e.cardWarn} aria-labelledby="statement-facts">
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id="statement-facts" className={e.title}>
            What the statement shows
          </h2>
          <span className={e.question}>{statementLine}</span>
        </div>
        <Badge tone="warn">
          <FileIcon size={14} />
          Uploaded · not verified
        </Badge>
      </div>
      {facts.length === 0 ? (
        <p className={e.empty}>Nothing could be read from this statement.</p>
      ) : (
        <ul className={e.list}>
          {facts.map((f) => (
            <li key={f.id} className={e.item}>
              <span className={e.iconWarn}>
                <FileIcon />
              </span>
              <span className={e.text}>
                <span className={e.statement}>{f.statement}</span>
                <span className={e.provenance}>{f.provenance}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
