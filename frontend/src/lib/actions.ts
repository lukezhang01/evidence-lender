'use server';

// Server Actions: the only way the browser changes anything. Each one forwards
// to the backend, which re-validates every rule; nothing here is trusted input.
import type { Applicant, DecisionRequest, FieldErrors } from '@evidence-lender/backend/contract';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from './api';
import { createFormatters } from './format';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; fields: FieldErrors };

const failure = (r: { message: string; fields: FieldErrors }) => ({ ok: false as const, message: r.message, fields: r.fields });

interface ApplyInput {
  applicationId: string | null;
  applicant: Applicant;
  requestedAmount: number;
  file: { fileName: string; csv: string };
}

export type ApplyFailure = { ok: false; message: string; fields: FieldErrors; applicationId: string | null };

// Creates the draft application, uploads the statement and submits, then
// redirects to the decision page. On failure the draft's id comes back, so a
// retry reuses it (and replaces the file) instead of starting another application.
export async function applyAction(input: ApplyInput): Promise<ApplyFailure> {
  let id = input.applicationId;
  if (!id) {
    const created = await api.createApplication({ applicant: input.applicant, requestedAmount: input.requestedAmount });
    if (!created.ok) return { ...failure(created), applicationId: null };
    id = created.data.id;
  }
  const uploaded = await api.uploadStatement(id, { fileName: String(input.file.fileName), csv: String(input.file.csv) });
  if (!uploaded.ok) return { ...failure(uploaded), applicationId: id };
  const submitted = await api.submitApplication(id, { applicant: input.applicant, requestedAmount: input.requestedAmount });
  if (!submitted.ok) return { ...failure(submitted), applicationId: id };
  redirect(`/apply/${encodeURIComponent(id)}`);
}

export async function decideAction(applicationId: string, request: DecisionRequest): Promise<ActionResult<null>> {
  const result = await api.recordDecision(applicationId, request);
  if (!result.ok) return failure(result);
  refresh();
  return { ok: true, data: null };
}

export async function quoteAction(amount: number): Promise<{ monthlyPayment: string } | null> {
  if (!Number.isInteger(amount)) return null;
  const offer = await api.getQuote(amount);
  return offer ? { monthlyPayment: createFormatters(await api.getConfig()).money(offer.monthlyPayment) } : null;
}
