'use server';

// Server Actions: the only way the browser changes anything. Each one forwards
// to the backend, which re-validates every rule; nothing here is trusted input.
import type { Applicant, BorrowerRequest, DecisionRequest, FieldErrors } from '@evidence-lender/backend/contract';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from './api';
import { createFormatters } from './format';
import { buildFoundView, type FoundView } from './views';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; fields: FieldErrors };

const failure = (r: { message: string; fields: FieldErrors }) => ({ ok: false as const, message: r.message, fields: r.fields });

interface StatementInput {
  applicationId: string | null;
  applicant: Applicant;
  requestedAmount: number;
}

type UploadResult =
  | { ok: true; data: { applicationId: string; found: FoundView } }
  | { ok: false; message: string; fields: FieldErrors; applicationId: string | null };

// Creates the draft application on the first upload; later uploads replace the
// file. The draft's id comes back even when the file is rejected, so a retry
// reuses it instead of starting another application.
async function upload(input: StatementInput, file: { fileName: string; csv: string }): Promise<UploadResult> {
  let id = input.applicationId;
  if (!id) {
    const created = await api.createApplication({ applicant: input.applicant, requestedAmount: input.requestedAmount });
    if (!created.ok) return { ...failure(created), applicationId: null };
    id = created.data.id;
  }
  const uploaded = await api.uploadStatement(id, { fileName: String(file.fileName), csv: String(file.csv) });
  if (!uploaded.ok) return { ...failure(uploaded), applicationId: id };
  const format = createFormatters(await api.getConfig());
  return { ok: true, data: { applicationId: id, found: buildFoundView(uploaded.data, format) } };
}

export async function uploadStatementAction(input: StatementInput, file: { fileName: string; csv: string }) {
  return upload(input, file);
}

export async function submitApplicationAction(
  applicationId: string,
  input: { applicant: Applicant; requestedAmount: number; borrowerNote: string },
): Promise<ActionResult<never>> {
  const submitted = await api.submitApplication(applicationId, input);
  if (!submitted.ok) return failure(submitted);
  redirect(`/apply/${encodeURIComponent(applicationId)}`);
}

export async function borrowerRequestAction(
  applicationId: string,
  kind: BorrowerRequest['kind'],
): Promise<ActionResult<null>> {
  const result = await api.sendBorrowerRequest(applicationId, kind);
  if (!result.ok) return failure(result);
  refresh();
  return { ok: true, data: null };
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
