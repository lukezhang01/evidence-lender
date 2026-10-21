import type { Metadata } from 'next';
import { BorrowerShell } from '@/components/borrower/BorrowerShell';
import { StartScreen } from '@/components/borrower/StartScreen';
import { getConfig } from '@/lib/api';
import { createFormatters } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return { title: `Apply · ${config.brand.name}` };
}

export default async function ApplyPage() {
  const config = await getConfig();
  const format = createFormatters(config);
  const amounts = config.borrower.amountOptions.map((value) => ({
    value,
    label: format.wholeMoney(value),
  }));

  return (
    <BorrowerShell brandName={config.brand.name} sampleData={config.sampleData}>
      <StartScreen amounts={amounts} selectedAmount={config.borrower.defaultAmount} />
    </BorrowerShell>
  );
}
