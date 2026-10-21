import type {
  Application,
  ConfigResponse,
  Decision,
  EvidenceRecord,
  Reviewer,
  Suggestion,
} from '@evidence-lender/backend/contract';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationHeader } from '@/components/lender/ApplicationHeader';
import { BlindSpots } from '@/components/lender/BlindSpots';
import { DecisionLogged } from '@/components/lender/DecisionLogged';
import { DecisionPanel, type SuggestionView } from '@/components/lender/DecisionPanel';
import { EvidenceSection, type SectionView } from '@/components/lender/EvidenceSection';
import { NoSuggestion } from '@/components/lender/NoSuggestion';
import { NotVerified } from '@/components/lender/NotVerified';
import {
  getApplication,
  getConfig,
  getEvidenceRecord,
  getQuote,
  getSuggestion,
  listDecisions,
  listReviewers,
} from '@/lib/api';
import { countLabel, provenanceLine, recordValue, shortHash, summarizeRecord } from '@/lib/evidence';
import { createFormatters, type Formatters } from '@/lib/format';
import { categories } from '@/lib/labels';
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
  const [config, record, suggestion, decisions, reviewers] = await Promise.all([
    getConfig(),
    recordId ? getEvidenceRecord(recordId) : undefined,
    getSuggestion(id),
    listDecisions(id),
    listReviewers(),
  ]);
  if (recordId && !record) {
    throw new Error(`Evidence record ${recordId} for application ${id} is missing`);
  }
  const format = createFormatters(config);
  const decision = decisions?.at(-1);

  return (
    <div className={styles.detailLayout}>
      <div className={styles.detail}>
        <ApplicationHeader application={application} record={record} format={format} />
        {buildSections(record, format).map((section) => (
          <EvidenceSection key={section.key} section={section} />
        ))}
        <NotVerified
          applicationId={application.id}
          uploads={buildUploads(record, format)}
          canRequest={application.status !== 'decided'}
          payrollRequested={application.sourceRequests.some((r) => r.kind === 'payroll')}
        />
        <BlindSpots
          blindSpots={
            record?.blindSpots ?? [
              {
                title: 'Everything, for now',
                note: 'No evidence has arrived from the applicant yet, so nothing here is visible to us.',
              },
            ]
          }
        />
      </div>
      <div className={styles.side}>
        <DecisionColumn
          application={application}
          record={record}
          suggestion={suggestion}
          decision={decision}
          reviewers={reviewers}
          config={config}
          format={format}
        />
      </div>
    </div>
  );
}

async function DecisionColumn(props: {
  application: Application;
  record: EvidenceRecord | undefined;
  suggestion: Suggestion | undefined;
  decision: Decision | undefined;
  reviewers: Reviewer[];
  config: ConfigResponse;
  format: Formatters;
}) {
  const { application, record, suggestion, decision, config, format } = props;
  const modelLine = suggestion
    ? `Model ${suggestion.modelVersion} · ${
        suggestion.modelValidatedAt
          ? `last validated ${format.recordDate(suggestion.modelValidatedAt)}`
          : 'validation date not recorded'
      }`
    : '';

  if (decision && record) {
    return <DecisionLogged {...loggedView(decision, application, record, props.reviewers, format)} />;
  }
  if (!suggestion || suggestion.outcome === 'none') {
    return (
      <NoSuggestion
        applicationId={application.id}
        reason={suggestion?.noneReason ?? 'nothing_submitted'}
        canRequest={application.status !== 'decided'}
        requested={application.sourceRequests.some((r) => r.kind === 'bank_or_payroll')}
        modelLine={modelLine}
      />
    );
  }

  const { min, max } = config.pricing.reviewerAdjustRange;
  const initialAmount = suggestion.offer?.amount ?? Math.min(application.requestedAmount, config.pricing.starterLimit);
  const initialQuote = await getQuote(initialAmount);
  return (
    <DecisionPanel
      applicationId={application.id}
      suggestion={suggestionView(suggestion, record, format, modelLine)}
      suggestedAmount={suggestion.offer?.amount ?? null}
      adjust={{
        min,
        max,
        rangeLabel: `${format.wholeMoney(min)} and ${format.wholeMoney(max)}`,
        initialAmount,
        initialPayment: initialQuote ? format.money(initialQuote.monthlyPayment) : '—',
      }}
      declineReasons={config.declineReasons.map((r) => ({ id: r.id, label: r.label }))}
    />
  );
}

// ---- view builders ---------------------------------------------------------

function buildSections(record: EvidenceRecord | undefined, format: Formatters): SectionView[] {
  const verified = record?.items.filter((i) => i.verified) ?? [];
  return categories.map((c) => {
    const items = verified.filter((i) => i.category === c.key);
    return {
      key: c.key,
      title: c.title,
      question: c.question,
      lastColumn: c.lastColumn,
      facts: items.map((i) => ({ id: i.id, statement: i.statement, provenance: provenanceLine(i, format) })),
      rows: items.flatMap((i) =>
        i.records.map((r, n) => ({
          key: `${i.id}-${n}`,
          date: format.recordDate(r.date),
          description: r.description,
          value: recordValue(r.value, format),
        })),
      ),
    };
  });
}

function buildUploads(record: EvidenceRecord | undefined, format: Formatters) {
  if (!record) return [];
  return record.items
    .filter((i) => !i.verified)
    .map((i) => {
      const covered = record.items.some((v) => v.verified && v.category === i.category);
      const category = categories.find((c) => c.key === i.category)?.title.toLowerCase();
      return {
        id: i.id,
        statement: i.statement,
        explanation: covered
          ? `Can’t be traced to its source. Verified ${category} facts already cover this, so it adds little.`
          : 'Can’t be traced to its source, and nothing verified at source covers it yet.',
        provenance: provenanceLine(i, format),
      };
    });
}

function suggestionView(
  suggestion: Suggestion,
  record: EvidenceRecord | undefined,
  format: Formatters,
  modelLine: string,
): SuggestionView {
  const offer = suggestion.offer;
  const metrics = suggestion.metrics;
  const statements = (metrics?.derivedFrom ?? [])
    .map((id) => record?.items.find((i) => i.id === id)?.statement)
    .filter((s): s is string => !!s);

  return {
    outcome: suggestion.outcome === 'approve' ? 'approve' : 'decline',
    title: offer ? `Approve ${format.wholeMoney(offer.amount)}` : 'Decline',
    summary: offer
      ? `${offer.termMonths} months at ${format.percent(offer.apr)} APR.${
          offer.amount < offer.stepUp.limit
            ? ` Can rise to ${format.wholeMoney(offer.stepUp.limit)} after ${offer.stepUp.onTimePayments} on-time payments.`
            : ''
        }`
      : null,
    metrics: metrics
      ? [
          { label: 'Monthly payment', value: format.money(metrics.monthlyPayment) },
          ...(metrics.paymentShareOfPay !== undefined
            ? [{ label: 'Payment as share of pay', value: format.percent(metrics.paymentShareOfPay) }]
            : []),
          ...(metrics.leftOverAfterPayment !== undefined
            ? [{ label: 'Left over after payment', value: `${format.wholeMoney(metrics.leftOverAfterPayment)} a month` }]
            : []),
        ]
      : [],
    metricsSource: statements.length
      ? `Computed from the suggested terms and these facts: ${statements.map((s) => `“${s}”`).join('; ')}.`
      : null,
    reasons: suggestion.reasons,
    modelLine,
  };
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
  rows.push({ label: 'Followed suggestion', value: decision.followedSuggestion ? 'Yes' : 'No, overridden' });
  if (decision.overrideNote) rows.push({ label: 'Reviewer note', value: decision.overrideNote });
  rows.push({ label: 'Logged', value: `${format.dateTime(decision.decidedAt)} · by ${reviewer}` });
  rows.push({
    label: 'Evidence',
    value: `${record.id} · ${countLabel(factCount, 'fact', 'facts')} · sha256 ${shortHash(record.sha256)}`,
  });
  for (const r of application.borrowerRequests) {
    rows.push({ label: 'Applicant response', value: `${responses[r.kind]?.(r.recheckOn)} · ${format.dateTime(r.requestedAt)}` });
  }

  const approved = decision.outcome === 'approved';
  const title = approved
    ? decision.followedSuggestion
      ? 'Approved as suggested'
      : 'Approved with new terms'
    : decision.followedSuggestion
      ? 'Declined as suggested'
      : 'Declined';
  return { title, rows };
}
