import type { Metadata } from 'next';
import { ApplyForm } from '@/components/borrower/ApplyForm';
import { BorrowerShell } from '@/components/borrower/BorrowerShell';
import { getConfig } from '@/lib/api';
import { createFormatters } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return { title: `Apply · ${config.brand.name}` };
}

export default async function ApplyPage() {
  const config = await getConfig();
  const format = createFormatters(config);
  const { min, max } = config.pricing.amountRange;

  return (
    <BorrowerShell brandName={config.brand.name}>
      <ApplyForm
        amountRange={{ min, max, label: `${format.wholeMoney(min)} to ${format.wholeMoney(max)}` }}
        minimumStatementMonths={config.borrower.minimumStatementMonths}
      />
    </BorrowerShell>
  );
}
