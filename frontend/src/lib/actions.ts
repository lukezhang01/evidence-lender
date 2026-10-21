'use server';

// Server Actions: the only way the browser changes anything. Each one forwards
// to the backend, which re-validates every rule; nothing here is trusted input.
import type {
  Applicant,
  BorrowerRequest,
  DecisionRequest,
  FieldErrors,
  SourceRequest,
} from '@evidence-lender/backend/contract';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from './api';
import { createFormatters } from './format';
import { buildFoundView, type FoundView } from './views';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string; fields: FieldErrors };

const failure = (r: { message: string; fields: FieldErrors }) => ({ ok: false as const, message: r.message, fields: r.fields });

async function formatters() {
  return createFormatters(await api.getConfig());
}

export async function connectBankAction(input: {
  applicationId: string | null;
  applicant: Applicant;
  requestedAmount: number;
  institutionId: string;
  profileId: string | null;
}): Promise<ActionResult<{ applicationId: string; found: FoundView }>> {
  let id = input.applicationId;
  if (!id) {
    const created = await api.createApplication({ applicant: input.applicant, requestedAmount: input.requestedAmount });
    if (!created.ok) return failure(created);
    id = created.data.id;
  }
  const connected = await api.connectBank(id, {
    institutionId: input.institutionId,
    ...(input.profileId ? { profileId: input.profileId } : {}),
  });
  if (!connected.ok) return failure(connected);
  return { ok: true, data: { applicationId: id, found: buildFoundView(connected.data, await formatters()) } };
}

// Only the file's name, type and size are sent; storing documents arrives with
// persistence (build order step 6).
export async function addUploadAction(
  applicationId: string,
  file: { name: string; type: string; size: number },
): Promise<ActionResult<FoundView>> {
  const uploaded = await api.addUpload(applicationId, {
    fileName: String(file.name),
    contentType: String(file.type),
    sizeBytes: Number(file.size) || 0,
  });
  if (!uploaded.ok) return failure(uploaded);
  return { ok: true, data: buildFoundView(uploaded.data, await formatters()) };
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

export async function requestSourceAction(
  applicationId: string,
  kind: SourceRequest['kind'],
): Promise<ActionResult<null>> {
  const result = await api.requestSource(applicationId, kind);
  if (!result.ok) return failure(result);
  refresh();
  return { ok: true, data: null };
}

export async function quoteAction(amount: number): Promise<{ monthlyPayment: string } | null> {
  if (!Number.isInteger(amount)) return null;
  const offer = await api.getQuote(amount);
  return offer ? { monthlyPayment: (await formatters()).money(offer.monthlyPayment) } : null;
}

export async function resetDemoAction(): Promise<void> {
  const result = await api.resetDemo();
  if (!result.ok) throw new Error(result.message);
  redirect('/review');
}
