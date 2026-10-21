import type { Application, Decision, EvidenceRecord, Reviewer } from '@evidence-lender/backend/contract';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationHeader } from '@/components/lender/ApplicationHeader';
import { BlindSpots } from '@/components/lender/BlindSpots';
import { DecisionLogged } from '@/components/lender/DecisionLogged';
import { DecisionPanel } from '@/components/lender/DecisionPanel';
import { EvidenceSection, type SectionView } from '@/components/lender/EvidenceSection';
import { ExperimentalScoreCard } from '@/components/lender/ExperimentalScoreCard';
import { StatementCard } from '@/components/lender/StatementCard';
import {
  getApplication,
  getConfig,
  getEvidenceRecord,
  getQuote,
  listDecisions,
  listReviewers,
} from '@/lib/api';
import { countLabel, provenanceLine, shortHash, statementLine, summarizeRecord } from '@/lib/evidence';
import { createFormatters, type Formatters } from '@/lib/format';
import { categories } from '@/lib/labels';
import { buildExperimentalView } from '@/lib/views';
import styles from '../review.module.css';

// Titles use the id, not the applicant's name, so names stay out of browser history.
export async function generateMetadata({ params }: PageProps<'/review/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: `Application ${id}` };
}

export default async function ApplicationPage({ params }: PageProps<'/review/[id]'>) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) notFound();

  const recordId = application.evidenceRecordId;
  const [config, record, decisions, reviewers] = await Promise.all([
    getConfig(),
    recordId ? getEvidenceRecord(recordId) : undefined,
    listDecisions(id),
    listReviewers(),
  ]);
  if (!record || !application.statement) {
    throw new Error(`Application ${id} has no sealed evidence record`);
  }
  const format = createFormatters(config);
  const decision = decisions?.at(-1);

  const { min, max } = config.pricing.reviewerAdjustRange;
  const initialAmount = Math.min(Math.max(application.requestedAmount, min), max, config.pricing.starterLimit);
  const initialQuote = decision ? undefined : await getQuote(initialAmount);

  return (
    <div className={styles.detailLayout}>
      <div className={styles.detail}>
        <ApplicationHeader application={application} record={record} format={format} />
        {buildSections(record, format).map((section) => (
          <EvidenceSection key={section.key} section={section} />
        ))}
        <StatementCard
          line={statementLine(application.statement, format)}
          uploaded={format.dateTime(application.statement.uploadedAt)}
          fileHash={{ short: shortHash(application.statement.fileSha256), full: application.statement.fileSha256 }}
        />
        <BlindSpots blindSpots={record.blindSpots} />
        <ExperimentalScoreCard view={buildExperimentalView(record.experimentalScore, format, config.currency)} />
      </div>
      <div className={styles.side}>
        {decision ? (
          <DecisionLogged {...loggedView(decision, application, record, reviewers, format)} />
        ) : (
          <DecisionPanel
            applicationId={application.id}
            requestedLabel={format.wholeMoney(application.requestedAmount)}
            approve={{
              min,
              max,
              rangeLabel: `${format.wholeMoney(min)} and ${format.wholeMoney(max)}`,
              initialAmount,
              initialPayment: initialQuote ? format.money(initialQuote.monthlyPayment) : '—',
              termsLine: `${config.pricing.termMonths} months at ${format.percent(config.pricing.apr)} APR${
                config.pricing.illustrative ? ' (illustrative)' : ''
              }.`,
            }}
            declineReasons={config.declineReasons.map((r) => ({ id: r.id, label: r.label }))}
          />
        )}
      </div>
    </div>
  );
}

// ---- view builders ---------------------------------------------------------

function buildSections(record: EvidenceRecord, format: Formatters): SectionView[] {
  return categories.map((c) => {
    const items = record.items.filter((i) => i.category === c.key);
    return {
      key: c.key,
      title: c.title,
      question: c.question,
      facts: items.map((i) => ({
        id: i.id,
        statement: i.statement,
        provenance: provenanceLine(i, format),
        verified: i.verified,
      })),
      // Several facts can rest on the same rows; list each statement row once.
      rows: [
        ...new Map(
          items.flatMap((i) => i.records).map((r) => [`${r.date}|${r.description}|${r.amount}|${r.balance ?? ''}`, r]),
        ),
      ]
        .sort(([, a], [, b]) => a.date.localeCompare(b.date))
        .map(([key, r]) => ({
          key,
          date: format.day(r.date),
          description: r.description,
          amount: format.money(r.amount),
          balance: r.balance === undefined ? '—' : format.money(r.balance),
        })),
    };
  });
}

function loggedView(
  decision: Decision,
  application: Application,
  record: EvidenceRecord,
  reviewers: Reviewer[],
  format: Formatters,
) {
  const reviewer = reviewers.find((r) => r.id === decision.reviewerId)?.name ?? decision.reviewerId;
  const { factCount } = summarizeRecord(record);
  const responses: Record<string, (recheckOn?: string) => string> = {
    accept_offer: () => 'Accepted the offer',
    talk_first: () => 'Asked to talk to someone first',
    recheck: (on) => (on ? `Opted into a re-check on ${format.longDay(on)}` : 'Opted into a re-check'),
    human_review: () => 'Asked a person to review',
  };
  const rows: { label: string; value: string }[] = [];
  if (decision.offer) {
    rows.push({ label: 'Amount', value: format.wholeMoney(decision.offer.amount) });
    rows.push({ label: 'Monthly payment', value: format.money(decision.offer.monthlyPayment) });
  }
  if (decision.applicantReason) rows.push({ label: 'Reason sent to applicant', value: decision.applicantReason });
  if (decision.overrideNote) rows.push({ label: 'Reviewer’s reason', value: decision.overrideNote });
  rows.push({ label: 'Logged', value: `${format.dateTime(decision.decidedAt)} · by ${reviewer}` });
  rows.push({
    label: 'Evidence',
    value: `${record.id} · ${countLabel(factCount, 'fact', 'facts')} · sha256 ${shortHash(record.sha256)}`,
  });
  for (const r of application.borrowerRequests) {
    rows.push({ label: 'Applicant response', value: `${responses[r.kind]?.(r.recheckOn)} · ${format.dateTime(r.requestedAt)}` });
  }
  return { title: decision.outcome === 'approved' ? 'Approved' : 'Declined', rows };
}
