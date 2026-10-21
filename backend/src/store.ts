import type {
  Application,
  ConfigResponse,
  Decision,
  EvidenceRecord,
  ProductConfig,
  Reviewer,
  Suggestion,
} from './contract.ts';
import type { EvidenceRecordFixture, SuggestionFixture } from './fixtures.ts';
import { sealItems } from './seal.ts';

export interface StoreData {
  reviewers: Reviewer[];
  currentReviewerId: string;
  applications: Application[];
  evidenceRecords: EvidenceRecordFixture[];
  suggestions: SuggestionFixture[];
  decisions: Decision[];
}

// In-memory, read-only view over the fixtures. This is the seam a real
// persistence layer replaces in build order step 6.
export function createStore(config: ProductConfig, data: StoreData) {
  const records = new Map<string, EvidenceRecord>(
    data.evidenceRecords.map((r) => [r.id, { ...r, sha256: sealItems(r.items) }]),
  );
  const applicationsById = new Map(data.applications.map((a) => [a.id, a]));

  function getSuggestion(applicationId: string): Suggestion | undefined {
    const application = applicationsById.get(applicationId);
    const fixture = data.suggestions.find((s) => s.applicationId === applicationId);
    if (!application || !fixture) return undefined;

    const record = application.evidenceRecordId ? records.get(application.evidenceRecordId) : undefined;
    const hasVerifiedEvidence = record?.items.some((item) => item.verified) ?? false;
    const base = {
      applicationId,
      modelVersion: fixture.modelVersion,
      modelValidatedAt: fixture.modelValidatedAt,
      pricingIllustrative: config.pricing.illustrative,
    };

    // Uploads never feed the suggestion: with nothing verified at source, there is none.
    if (!hasVerifiedEvidence || fixture.outcome === 'none') {
      return { ...base, outcome: 'none', reasons: [] };
    }
    if (fixture.outcome === 'decline') {
      return { ...base, outcome: 'decline', reasons: fixture.reasons };
    }
    return {
      ...base,
      outcome: 'approve',
      amount: Math.min(application.requestedAmount, config.pricing.starterLimit),
      termMonths: config.pricing.termMonths,
      apr: config.pricing.apr,
      reasons: fixture.reasons,
    };
  }

  return {
    getConfig(): ConfigResponse {
      return { ...config, sampleData: true };
    },
    getCurrentReviewer(): Reviewer | undefined {
      return data.reviewers.find((r) => r.id === data.currentReviewerId);
    },
    listApplications(): Application[] {
      return [...data.applications].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
    },
    getApplication(id: string): Application | undefined {
      return applicationsById.get(id);
    },
    getEvidenceRecord(id: string): EvidenceRecord | undefined {
      return records.get(id);
    },
    getSuggestion,
    listDecisions(applicationId: string): Decision[] {
      return data.decisions
        .filter((d) => d.applicationId === applicationId)
        .sort((a, b) => Date.parse(a.decidedAt) - Date.parse(b.decidedAt));
    },
  };
}

export type Store = ReturnType<typeof createStore>;
