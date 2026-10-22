import type { BorrowerView } from '@evidence-lender/backend/contract';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/borrower/AutoRefresh';
import { BorrowerCard, BorrowerFooter, BorrowerShell } from '@/components/borrower/BorrowerShell';
import s from '@/components/borrower/borrower.module.css';
import { CheckIcon } from '@/components/ui/icons';
import { getBorrowerView, getConfig } from '@/lib/api';
import { scoreProvenanceLine } from '@/lib/evidence';
import { createFormatters, type Formatters } from '@/lib/format';
import { scoreLabel } from '@/lib/views';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return { title: `Your application · ${config.brand.name}` };
}

// No sign-in yet: anyone with this link can see the outcome.
export default async function ApplicationStatusPage({ params }: PageProps<'/apply/[id]'>) {
  const { id } = await params;
  const [config, view] = await Promise.all([getConfig(), getBorrowerView(id)]);
  if (!view) notFound();
  const format = createFormatters(config);
  const { application, outcome } = view;

  return (
    <BorrowerShell brandName={config.brand.name}>
      <BorrowerCard>
        <div className={s.screenLoose}>
          {outcome.kind === 'in_review' && <AutoRefresh />}
          <Heading view={view} format={format} />
          <CreditScore view={view} format={format} />
          {outcome.kind === 'in_review' && (
            <Rows
              rows={[
                ['Suggested interest rate', `${format.percent(config.pricing.apr)} APR`],
                ['Amount requested', format.wholeMoney(application.requestedAmount)],
              ]}
            />
          )}
          {outcome.kind === 'approved' && (
            <Rows
              rows={[
                ['Interest rate', `${format.percent(outcome.offer.apr)} APR`],
                ['Term', `${outcome.offer.termMonths} months`],
                ['Monthly payment', format.money(outcome.offer.monthlyPayment)],
                ['Total cost of borrowing', format.money(outcome.offer.totalCostOfBorrowing)],
              ]}
            />
          )}
          {outcome.kind === 'declined' && (
            <>
              <List title="Why" items={outcome.reasons} />
              {outcome.whatWouldChange.length > 0 && <List title="What would change it" items={outcome.whatWouldChange} />}
            </>
          )}
        </div>
      </BorrowerCard>
      <BorrowerFooter>
        <Link href="/apply">Start a new application</Link>
      </BorrowerFooter>
    </BorrowerShell>
  );
}

const pills = {
  in_review: { className: s.pillNeutral, label: 'Submitted' },
  approved: { className: s.pillOk, label: 'Approved' },
  declined: { className: s.pillWarn, label: 'Not approved' },
};

function Heading({ view, format }: { view: BorrowerView; format: Formatters }) {
  const { application, outcome } = view;
  const pill = pills[outcome.kind];
  let title = 'A person is reviewing your application';
  let lead: string | null = 'This page updates when there’s a decision.';
  if (outcome.kind === 'approved') {
    title = `You’re approved for ${format.wholeMoney(outcome.offer.amount)}`;
    lead =
      outcome.offer.amount < application.requestedAmount
        ? `You asked for ${format.wholeMoney(application.requestedAmount)}.`
        : null;
  } else if (outcome.kind === 'declined') {
    title = 'We can’t approve this today';
    lead = null;
  }
  return (
    <div className={s.intro}>
      <span className={pill.className}>
        {outcome.kind === 'approved' && <CheckIcon size={14} />}
        {pill.label}
      </span>
      <h1 className={s.title}>{title}</h1>
      {lead && <p className={s.lead}>{lead}</p>}
    </div>
  );
}

// The experimental model's score, with where it came from (rule 1) or why
// there isn't one (rule 3).
function CreditScore({ view, format }: { view: BorrowerView; format: Formatters }) {
  const label = scoreLabel(view.score, format);
  return (
    <section className={s.score} aria-labelledby="credit-score">
      <div className={s.scoreHead}>
        <h2 id="credit-score" className={s.sectionLabel}>
          Credit score
        </h2>
        <span className={s.scoreValue}>{label.score ?? 'None'}</span>
      </div>
      <p className={s.scoreNote}>
        {label.score === null
          ? label.reason
          : 'From 0 to 1; lower is better. Worked out from your bank statement by an experimental model, not by a credit bureau.'}
      </p>
      <span className={s.provenance}>{scoreProvenanceLine(view.score, format, { compact: true })}</span>
    </section>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className={s.rows}>
      {rows.map(([label, value]) => (
        <div key={label} className={s.row}>
          <dt className={s.rowLabel}>{label}</dt>
          <dd className={s.rowValue}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={s.intro}>
      <h2 className={s.sectionLabel}>{title}</h2>
      <ul className={s.bullets}>
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}
