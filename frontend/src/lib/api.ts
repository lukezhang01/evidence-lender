// Server-side client for the backend API. Every value the screens show comes
// through here or from config; components hold no sample data.
import type {
  ApiError,
  Application,
  BorrowerRequest,
  BorrowerView,
  ConfigResponse,
  Decision,
  DecisionRequest,
  DraftEvidence,
  EvidenceRecord,
  FieldErrors,
  Offer,
  Reviewer,
  StatementUpload,
} from '@evidence-lender/backend/contract';
import { connection } from 'next/server';
import { cache } from 'react';

function apiUrl(path: string): URL {
  const base = process.env.API_BASE_URL;
  if (!base) throw new Error('API_BASE_URL is not set. See frontend/.env.example.');
  return new URL(path, base);
}

async function getJson<T>(path: string): Promise<T | undefined> {
  // Application data is per request; never bake it into the build.
  await connection();
  const res = await fetch(apiUrl(path), { cache: 'no-store' });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}

async function getRequired<T>(path: string): Promise<T> {
  const body = await getJson<T>(path);
  if (body === undefined) throw new Error(`GET ${path} returned 404`);
  return body;
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; fields: FieldErrors };

async function send<T>(path: string, body: unknown): Promise<Result<T>> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => null)) as T | ApiError | null;
  if (res.ok) return { ok: true, data: json as T };
  const error = (json as ApiError | null)?.error;
  if (res.status >= 500 || !error) throw new Error(`POST ${path} failed with status ${res.status}`);
  return { ok: false, status: res.status, message: error.message, fields: error.fields ?? {} };
}

const segment = (id: string) => encodeURIComponent(id);
const app = (id: string, rest = '') => `/api/applications/${segment(id)}${rest}`;

// ---- reads -----------------------------------------------------------------

export const getConfig = cache(() => getRequired<ConfigResponse>('/api/config'));
export const getCurrentReviewer = cache(() => getRequired<Reviewer>('/api/me'));
export const listReviewers = cache(() => getRequired<Reviewer[]>('/api/reviewers'));
export const listApplications = cache(() => getRequired<Application[]>('/api/applications'));
export const getApplication = cache((id: string) => getJson<Application>(app(id)));
export const listDecisions = cache((id: string) => getJson<Decision[]>(app(id, '/decisions')));
export const getBorrowerView = cache((id: string) => getJson<BorrowerView>(app(id, '/borrower-view')));
export const getEvidenceRecord = cache((id: string) =>
  getJson<EvidenceRecord>(`/api/evidence-records/${segment(id)}`),
);
export const getSampleStatement = (id: string) => getJson<StatementUpload>(`/api/demo/statements/${segment(id)}`);

export async function getQuote(amount: number): Promise<Offer | undefined> {
  const res = await fetch(apiUrl(`/api/quote?amount=${encodeURIComponent(amount)}`), { cache: 'no-store' });
  return res.ok ? ((await res.json()) as Offer) : undefined;
}

// ---- writes ----------------------------------------------------------------

export const createApplication = (body: { applicant: Application['applicant']; requestedAmount: number }) =>
  send<Application>('/api/applications', body);

export const uploadStatement = (id: string, body: StatementUpload) =>
  send<DraftEvidence>(app(id, '/statement'), body);

export const submitApplication = (
  id: string,
  body: { applicant: Application['applicant']; requestedAmount: number; borrowerNote?: string },
) => send<Application>(app(id, '/submit'), body);

export const recordDecision = (id: string, body: DecisionRequest) => send<Decision>(app(id, '/decisions'), body);

export const sendBorrowerRequest = (id: string, kind: BorrowerRequest['kind']) =>
  send<Application>(app(id, '/borrower-requests'), { kind });

export const resetDemo = () => send<{ ok: true }>('/api/demo/reset', {});
