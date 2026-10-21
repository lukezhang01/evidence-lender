import type { BorrowerRequest, BorrowerView, ConfigResponse } from '@evidence-lender/backend/contract';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/borrower/AutoRefresh';
import { BorrowerCard, BorrowerFooter, BorrowerShell } from '@/components/borrower/BorrowerShell';
import { OutcomeActions } from '@/components/borrower/OutcomeActions';
import { Progress } from '@/components/borrower/Progress';
import s from '@/components/borrower/borrower.module.css';
import { CalendarIcon, CheckIcon } from '@/components/ui/icons';
import { getBorrowerView, getConfig } from '@/lib/api';
import { createFormatters, type Formatters } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return { title: `Your application · ${config.brand.name}` };
}

// No sign-in yet (build order step 6): anyone with this link can see the outcome.
export default async function ApplicationStatusPage({ params }: PageProps<'/apply/[id]'>) {
  const { id } = await params;
  const [config, view] = await Promise.all([getConfig(), getBorrowerView(id)]);
  if (!view) notFound();
  const format = createFormatters(config);
  const { outcome } = view;

  return (
    <BorrowerShell brandName={config.brand.name}>
      <BorrowerCard>
        <div className={s.top}>
          <Progress current={4} />
        </div>
        {outcome.kind === 'in_review' && <InReview view={view} config={config} format={format} />}
        {outcome.kind === 'approved' && <Approved view={view} config={config} format={format} />}
        {outcome.kind === 'declined' && <Declined view={view} config={config} format={format} />}
      </BorrowerCard>
      <BorrowerFooter>
        <Link href="/apply">Start a new application</Link>
      </BorrowerFooter>
    </BorrowerShell>
  );
}

interface ScreenProps {
  view: BorrowerView;
  config: ConfigResponse;
  format: Formatters;
}

const contactOf = (view: BorrowerView) => view.application.applicant.email || view.application.applicant.phone;

function requestsDone(view: BorrowerView) {
  return new Map<BorrowerRequest['kind'], BorrowerRequest>(view.application.borrowerRequests.map((r) => [r.kind, r]));
}

function InReview({ view, format }: ScreenProps) {
  const { application } = view;
  return (
    <div className={s.screenLoose}>
      <AutoRefresh />
      <div className={s.introLoose}>
        <span className={s.pillNeutral}>Submitted</span>
        <h1 className={s.title}>A person is reviewing your application</h1>
        <p className={s.leadLarge}>
          They see exactly what you saw from your statement, plus any note you added. This page updates by itself
          when there’s a decision.
        </p>
      </div>
      <div className={s.rows}>
        <div className={s.row}>
          <span className={s.rowLabel}>Amount requested</span>
          <span className={s.rowValue}>{format.wholeMoney(application.requestedAmount)}</span>
        </div>
        {application.submittedAt && (
          <div className={s.row}>
            <span className={s.rowLabel}>Submitted</span>
            <span className={s.rowValue}>{format.dateTime(application.submittedAt)}</span>
          </div>
        )}
        <div className={s.row}>
          <span className={s.rowLabel}>Application</span>
          <span className={s.rowValue}>{application.id}</span>
        </div>
      </div>
      <p className={s.footnote}>This decision doesn’t use a credit score.</p>
    </div>
  );
}

function Approved({ view, format }: ScreenProps) {
  if (view.outcome.kind !== 'approved') return null;
  const { offer } = view.outcome;
  const { application } = view;
  const { stepUp } = offer;
  const askLine =
    offer.amount >= stepUp.limit
      ? null
      : application.requestedAmount > offer.amount
        ? `You asked for ${format.wholeMoney(application.requestedAmount)}. We’re starting at ${format.wholeMoney(offer.amount)}, and after ${stepUp.onTimePayments} on-time payments you can borrow up to ${format.wholeMoney(stepUp.limit)}.`
        : `After ${stepUp.onTimePayments} on-time payments, you can borrow up to ${format.wholeMoney(stepUp.limit)}.`;
  const terms: [string, string][] = [
    ['Amount', format.wholeMoney(offer.amount)],
    ['Term', `${offer.termMonths} months`],
    ['Monthly payment', format.money(offer.monthlyPayment)],
    ['Interest rate', `${format.percent(offer.apr)} APR`],
    ['Total cost of borrowing', format.money(offer.totalCostOfBorrowing)],
  ];
  const done = requestsDone(view);

  return (
    <div className={s.screenLoose}>
      <div className={s.introLoose}>
        <span className={s.pillOk}>
          <CheckIcon size={14} />
          Approved
        </span>
        <h1 className={s.title}>You’re approved for {format.wholeMoney(offer.amount)}</h1>
        {askLine && <p className={s.leadLarge}>{askLine}</p>}
      </div>
      <div className={s.actions}>
        <dl className={s.rows}>
          {terms.map(([label, value]) => (
            <div key={label} className={s.row}>
              <dt className={s.rowLabel}>{label}</dt>
              <dd className={s.rowValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={s.inset}>
        <span className={s.iconAccent}>
          <CalendarIcon size={18} />
        </span>
        <span>Payments come out the day after your payday, so the money is there. You can change the date any time.</span>
      </div>
      <OutcomeActions
        applicationId={application.id}
        kind="approved"
        recheckLabel=""
        done={{
          ...(done.has('accept_offer')
            ? {
                accept_offer: `Offer accepted. In the live product, you sign your agreement online and the money goes to your bank account.`,
              }
            : {}),
          ...(done.has('talk_first')
            ? { talk_first: `Thanks. Someone from our team will contact you at ${contactOf(view)} before anything is final.` }
            : {}),
        }}
      />
    </div>
  );
}

function Declined({ view, config, format }: ScreenProps) {
  if (view.outcome.kind !== 'declined') return null;
  const { reasons, whatWouldChange } = view.outcome;
  const months = config.borrower.recheckMonths;
  const done = requestsDone(view);
  const recheckOn = done.get('recheck')?.recheckOn;

  return (
    <div className={s.screenLoose}>
      <div className={s.introLoose}>
        <span className={s.pillWarn}>Not yet</span>
        <h1 className={s.title}>We can’t approve this today</h1>
        <p className={s.leadLarge}>
          Here’s exactly why, and what would change it. This decision didn’t use a credit score.
        </p>
      </div>
      <div className={s.actionsLoose}>
        <h2 className={s.sectionLabel}>{reasons.length === 1 ? 'The main reason' : 'The main reasons'}</h2>
        <ol className={s.list}>
          {reasons.map((text, i) => (
            <li key={text} className={s.reasonRow}>
              <span className={s.numberBadge} aria-hidden="true">
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className={s.soft}>
        <h2 className={s.softTitle}>What would change it</h2>
        {whatWouldChange.length > 0 && (
          <ul className={s.list}>
            {whatWouldChange.map((text) => (
              <li key={text} className={s.checkRow}>
                <span className={s.iconAccent}>
                  <CheckIcon />
                </span>
                {text}
              </li>
            ))}
          </ul>
        )}
        <p className={s.softBody}>
          With your permission, we’ll ask you for a new statement in {months} months and look again. No new
          application needed.
        </p>
      </div>
      <OutcomeActions
        applicationId={view.application.id}
        kind="declined"
        recheckLabel={`Check again in ${months} months`}
        done={{
          ...(recheckOn ? { recheck: `Done. We’ll check again on ${format.longDay(recheckOn)} and tell you either way.` } : {}),
          ...(done.has('human_review')
            ? { human_review: `Request sent. A person will look at your application again and contact you at ${contactOf(view)}.` }
            : {}),
        }}
      />
    </div>
  );
}
