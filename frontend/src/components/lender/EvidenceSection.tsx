'use client';

import { useId, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { CheckIcon, ChevronDownIcon, FileIcon, ShieldCheckIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

export interface SectionView {
  key: string;
  title: string;
  question: string;
  facts: { id: string; statement: string; provenance: string; verified: boolean }[];
  rows: { key: string; date: string; description: string; amount: string; balance: string }[];
}

// One of Identity, Capacity, Willingness, Resilience. Always rendered, even
// when empty, so a missing category is visible rather than hidden. Facts that
// aren't verified at source say so, here and in their badge (rule 2).
export function EvidenceSection({ section }: { section: SectionView }) {
  const [open, setOpen] = useState(false);
  const recordsId = useId();
  const headingId = `section-${section.key}`;
  const verified = section.facts.filter((f) => f.verified);
  const unverified = section.facts.filter((f) => !f.verified);

  return (
    <section className={e.card} aria-labelledby={headingId}>
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id={headingId} className={e.title}>
            {section.title}
          </h2>
          <span className={e.question}>{section.question}</span>
        </div>
        {section.facts.length === 0 ? (
          <Badge tone="neutral">Nothing found</Badge>
        ) : unverified.length > 0 ? (
          <Badge tone="warn">
            <FileIcon size={14} />
            Not verified · uploaded statement
          </Badge>
        ) : (
          <Badge tone="ok">
            <ShieldCheckIcon size={14} />
            Verified at source
          </Badge>
        )}
      </div>

      {section.facts.length === 0 && <p className={e.empty}>The statement doesn’t show anything for this.</p>}
      {[verified, unverified].map(
        (facts, group) =>
          facts.length > 0 && (
            <ul key={group} className={e.list}>
              {facts.map((f) => (
                <li key={f.id} className={e.item}>
                  <span className={f.verified ? e.iconOk : e.iconWarn}>
                    {f.verified ? <CheckIcon /> : <FileIcon />}
                  </span>
                  <span className={e.text}>
                    <span className={e.statement}>{f.statement}</span>
                    <span className={e.provenance}>{f.provenance}</span>
                  </span>
                </li>
              ))}
            </ul>
          ),
      )}

      {section.rows.length > 0 && (
        <>
          <button
            type="button"
            className={e.toggle}
            aria-expanded={open}
            aria-controls={recordsId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide' : 'Show'} statement rows ({section.rows.length})
            <ChevronDownIcon className={open ? e.chevronOpen : undefined} />
          </button>
          <div id={recordsId} className={e.tableWrap} hidden={!open}>
            <table className={e.table} aria-label={`Statement rows for ${section.title}`}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Balance</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={e.mono}>{r.date}</td>
                    <td>{r.description}</td>
                    <td className={e.monoValue}>{r.amount}</td>
                    <td className={e.monoValue}>{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
