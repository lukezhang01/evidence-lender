'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ChevronDownIcon, FileIcon, ShieldCheckIcon } from '@/components/ui/icons';
import type { FoundView } from '@/lib/views';
import s from './borrower.module.css';
import own from './FoundStep.module.css';

interface FoundStepProps {
  found: FoundView;
  historyMonths: number;
  uploading: boolean;
  uploadError: string | null;
  noteOpen: boolean;
  borrowerNote: string;
  submitting: boolean;
  submitError: string | null;
  onUpload: (file: File) => void;
  onToggleNote: () => void;
  onEditNote: (value: string) => void;
  onSubmit: () => void;
}

export function FoundStep(props: FoundStepProps) {
  const { found } = props;
  const [showAll, setShowAll] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const factsId = useId();

  return (
    <div className={s.screen}>
      <div className={s.intro}>
        <h2 className={s.heading} tabIndex={-1} data-step-heading>
          Here’s what we found
        </h2>
        <p className={s.lead}>
          This is exactly what a reviewer will see. If something’s wrong, tell us before you submit.
        </p>
      </div>

      <div className={own.sourceBadge}>
        <ShieldCheckIcon size={15} />
        <span>
          From {found.institutionName ?? 'your bank'} · read-only · last {props.historyMonths} months
        </span>
      </div>

      <ul className={own.tiles}>
        {found.tiles.map((t) => (
          <li key={t.id} className={own.tile}>
            <span className={own.tileLabel}>{t.label}</span>
            <span className={own.tileValue}>{t.value}</span>
            <span className={own.tileNote}>{t.note}</span>
            <span className={s.provenance}>{t.provenance}</span>
          </li>
        ))}
      </ul>

      <div>
        <button
          type="button"
          className={own.toggle}
          aria-expanded={showAll}
          aria-controls={factsId}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Hide' : 'Show'} all {found.factCount} facts the reviewer sees
          <ChevronDownIcon className={showAll ? own.chevronOpen : undefined} />
        </button>
        <div id={factsId} hidden={!showAll} className={own.facts}>
          {found.factsByCategory.map((group) => (
            <section key={group.key} className={own.factGroup}>
              <h3 className={own.factGroupTitle}>{group.title}</h3>
              {group.facts.length === 0 ? (
                <p className={own.empty}>Nothing in this section yet.</p>
              ) : (
                <ul className={s.list}>
                  {group.facts.map((f) => (
                    <li key={f.id} className={own.fact}>
                      <span>{f.statement}</span>
                      <span className={s.provenance}>{f.provenance}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>

      <div className={own.cantSee}>
        <span className={own.cantSeeTitle}>Something we can’t see?</span>
        <span className={own.cantSeeBody}>
          Income or debts at another bank, or cash income. Add a note or a document.
        </span>
        {found.uploads.map((u) => (
          <div key={u.id} className={own.upload}>
            <span className={own.uploadIcon}>
              <FileIcon size={20} />
            </span>
            <span className={own.uploadText}>
              <span className={own.uploadName}>{u.statement}</span>
              <span className={own.uploadNote}>A person will check it. It counts for less than data from your bank.</span>
              <span className={s.provenance}>{u.provenance}</span>
            </span>
          </div>
        ))}
        {props.uploadError && (
          <p className={s.fieldError} role="alert">
            {props.uploadError}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,image/*"
          className={own.fileInput}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) props.onUpload(file);
          }}
        />
        <button
          type="button"
          className={s.smallButton}
          disabled={props.uploading}
          onClick={() => fileInput.current?.click()}
        >
          {props.uploading ? 'Adding…' : 'Add a document'}
        </button>
      </div>

      {props.noteOpen && (
        <div className={s.field}>
          <label htmlFor="f-wrong" className={s.label}>
            What looks wrong?
          </label>
          <textarea
            id="f-wrong"
            rows={3}
            className={s.textarea}
            placeholder="My March pay was lower because I took a week of unpaid leave"
            value={props.borrowerNote}
            onChange={(e) => props.onEditNote(e.target.value)}
          />
          <span className={s.caption}>Your note goes to the reviewer with your application.</span>
        </div>
      )}

      {props.submitError && (
        <p className={s.alert} role="alert">
          {props.submitError}
        </p>
      )}
      <div className={s.actions}>
        <Button fullWidth onClick={props.onSubmit} disabled={props.submitting} aria-busy={props.submitting}>
          {props.submitting ? 'Submitting…' : 'Submit application'}
        </Button>
        <button type="button" className={s.linkButton} onClick={props.onToggleNote} aria-expanded={props.noteOpen}>
          {props.noteOpen ? 'Hide note' : 'Something looks wrong'}
        </button>
      </div>
    </div>
  );
}
