import type { Metadata } from 'next';
import { LenderShell } from '@/components/lender/LenderShell';
import { Queue } from '@/components/lender/Queue';
import { getConfig, getCurrentReviewer, listApplications } from '@/lib/api';
import { createFormatters } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getConfig();
  return { title: { template: `%s · ${brand.name}`, default: `Review queue · ${brand.name}` } };
}

export default async function ReviewLayout({ children }: LayoutProps<'/review'>) {
  const [config, reviewer, applications] = await Promise.all([
    getConfig(),
    getCurrentReviewer(),
    listApplications(),
  ]);

  return (
    <LenderShell
      brandName={config.brand.name}
      sampleData={config.sampleData}
      reviewer={reviewer}
      queue={<Queue applications={applications} format={createFormatters(config)} />}
    >
      {children}
    </LenderShell>
  );
}
