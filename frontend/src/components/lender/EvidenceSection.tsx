'use client';

import { useId, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { CheckIcon, ChevronDownIcon, ShieldCheckIcon } from '@/components/ui/icons';
import e from './Evidence.module.css';

export interface SectionView {
  key: string;
  title: string;
  question: string;
  lastColumn: string;
  facts: { id: string; statement: string; provenance: string }[];
  rows: { key: string; date: string; description: string; value: string }[];
}

// One of Identity, Capacity, Willingness, Resilience. Always rendered, even
// when empty, so a missing category is visible rather than hidden.
export function EvidenceSection({ section }: { section: SectionView }) {
  const [open, setOpen] = useState(false);
  const recordsId = useId();
  const headingId = `section-${section.key}`;

  return (
    <section className={e.card} aria-labelledby={headingId}>
      <div className={e.head}>
        <div className={e.titles}>
          <h2 id={headingId} className={e.title}>
            {section.title}
          </h2>
          <span className={e.question}>{section.question}</span>
        </div>
        {section.facts.length > 0 ? (
          <Badge tone="ok">
            <ShieldCheckIcon size={14} />
            Verified at source
          </Badge>
        ) : (
          <Badge tone="neutral">Nothing verified yet</Badge>
        )}
      </div>

      {section.facts.length === 0 ? (
        <p className={e.empty}>No source-verified facts in this section.</p>
      ) : (
        <ul className={e.list}>
          {section.facts.map((f) => (
            <li key={f.id} className={e.item}>
              <span className={e.iconOk}>
                <CheckIcon />
              </span>
              <span className={e.text}>
                <span className={e.statement}>{f.statement}</span>
                <span className={e.provenance}>{f.provenance}</span>
              </span>
            </li>
          ))}
        </ul>
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
            {open ? 'Hide' : 'Show'} source records ({section.rows.length})
            <ChevronDownIcon className={open ? e.chevronOpen : undefined} />
          </button>
          <div id={recordsId} className={e.tableWrap} hidden={!open}>
            <table className={e.table} aria-label={`Source records for ${section.title}`}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Record</th>
                  <th scope="col">{section.lastColumn}</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={e.mono}>{r.date}</td>
                    <td>{r.description}</td>
                    <td className={e.monoValue}>{r.value}</td>
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
