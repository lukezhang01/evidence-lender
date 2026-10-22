import type { Decision, EvidenceRecord, Reviewer } from '@evidence-lender/backend/contract';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationHeader } from '@/components/lender/ApplicationHeader';
import { BlindSpots } from '@/components/lender/BlindSpots';
import { CreditScoreCard } from '@/components/lender/CreditScoreCard';
import { DecisionLogged } from '@/components/lender/DecisionLogged';
import { DecisionPanel } from '@/components/lender/DecisionPanel';
import { StatementFacts } from '@/components/lender/StatementFacts';
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
import { buildScoreView } from '@/lib/views';
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

  const { min, max } = config.pricing.amountRange;
  const initialAmount = Math.min(Math.max(application.requestedAmount, min), max);
  const initialQuote = decision ? undefined : await getQuote(initialAmount);

  return (
    <div className={styles.detailLayout}>
      <div className={styles.detail}>
        <ApplicationHeader application={application} format={format} />
        <CreditScoreCard view={buildScoreView(record.experimentalScore, format, config.currency)} />
        <StatementFacts
          statementLine={statementLine(application.statement, format)}
          facts={record.items.map((i) => ({ id: i.id, statement: i.statement, provenance: provenanceLine(i, format) }))}
        />
        <BlindSpots blindSpots={record.blindSpots} />
      </div>
      <div className={styles.side}>
        {decision ? (
          <DecisionLogged {...loggedView(decision, record, reviewers, format)} />
        ) : (
          <DecisionPanel
            applicationId={application.id}
            approve={{
              min,
              max,
              rangeLabel: `${format.wholeMoney(min)} to ${format.wholeMoney(max)}`,
              initialAmount,
              initialPayment: initialQuote ? format.money(initialQuote.monthlyPayment) : '—',
              termsLine: `${config.pricing.termMonths} months at ${format.percent(config.pricing.apr)} APR.`,
            }}
            declineReasons={config.declineReasons.map((r) => ({ id: r.id, label: r.label }))}
          />
        )}
      </div>
    </div>
  );
}

// ---- view builders ---------------------------------------------------------

function loggedView(decision: Decision, record: EvidenceRecord, reviewers: Reviewer[], format: Formatters) {
  const reviewer = reviewers.find((r) => r.id === decision.reviewerId)?.name ?? decision.reviewerId;
  const { factCount } = summarizeRecord(record);
  const rows: { label: string; value: string }[] = [];
  if (decision.offer) {
    rows.push({ label: 'Amount', value: format.wholeMoney(decision.offer.amount) });
    rows.push({ label: 'Monthly payment', value: format.money(decision.offer.monthlyPayment) });
  }
  if (decision.applicantReason) rows.push({ label: 'Reason sent to applicant', value: decision.applicantReason });
  if (decision.overrideNote) rows.push({ label: 'Reviewer’s reason', value: decision.overrideNote });
  rows.push({ label: 'Logged', value: `${format.dateTime(decision.decidedAt)} · by ${reviewer}` });
  // Rule 6: the decision points at the sealed evidence it was made on.
  rows.push({
    label: 'Evidence',
    value: `${record.id} · ${countLabel(factCount, 'fact', 'facts')} · sha256 ${shortHash(record.sha256)}`,
  });
  return { title: decision.outcome === 'approved' ? 'Approved' : 'Declined', rows };
}
