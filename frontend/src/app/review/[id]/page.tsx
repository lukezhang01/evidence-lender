import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApplicationHeader } from '@/components/lender/ApplicationHeader';
import { getApplication, getConfig, getEvidenceRecord } from '@/lib/api';
import { createFormatters } from '@/lib/format';

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
  const [config, record] = await Promise.all([
    getConfig(),
    recordId ? getEvidenceRecord(recordId) : undefined,
  ]);
  if (recordId && !record) {
    throw new Error(`Evidence record ${recordId} for application ${id} is missing`);
  }

  // Next: evidence sections, Not verified and Blind spots (build order step 3),
  // then the decision panel (step 4).
  return <ApplicationHeader application={application} record={record} format={createFormatters(config)} />;
}
