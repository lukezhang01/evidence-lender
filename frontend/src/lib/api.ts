// Server-side client for the backend API. Every value the screens show comes
// through here or from config; components hold no sample data.
import type {
  Application,
  ConfigResponse,
  EvidenceRecord,
  Reviewer,
} from '@evidence-lender/backend/contract';
import { connection } from 'next/server';
import { cache } from 'react';

function apiBaseUrl(): string {
  const url = process.env.API_BASE_URL;
  if (!url) {
    throw new Error('API_BASE_URL is not set. See frontend/.env.example.');
  }
  return url;
}

async function getJson<T>(path: string): Promise<T | undefined> {
  // Application data is per request; never bake it into the build.
  await connection();
  const res = await fetch(new URL(path, apiBaseUrl()), { cache: 'no-store' });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GET ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}

async function getRequired<T>(path: string): Promise<T> {
  const body = await getJson<T>(path);
  if (body === undefined) throw new Error(`GET ${path} returned 404`);
  return body;
}

const segment = (id: string) => encodeURIComponent(id);

export const getConfig = cache(() => getRequired<ConfigResponse>('/api/config'));

export const getCurrentReviewer = cache(() => getRequired<Reviewer>('/api/me'));

export const listApplications = cache(() => getRequired<Application[]>('/api/applications'));

export const getApplication = cache((id: string) =>
  getJson<Application>(`/api/applications/${segment(id)}`),
);

export const getEvidenceRecord = cache((id: string) =>
  getJson<EvidenceRecord>(`/api/evidence-records/${segment(id)}`),
);
