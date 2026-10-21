import type { Metadata } from 'next';
import { BorrowerFlow } from '@/components/borrower/BorrowerFlow';
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

  return (
    <BorrowerShell brandName={config.brand.name} sampleData={config.sampleData}>
      <BorrowerFlow
        amounts={config.borrower.amountOptions.map((value) => ({ value, label: format.wholeMoney(value) }))}
        defaultAmount={config.borrower.defaultAmount}
        minimumStatementMonths={config.borrower.minimumStatementMonths}
        sampleData={config.sampleData}
        sampleApplicant={config.demo?.sampleApplicant ?? null}
        sampleStatements={config.demo?.sampleStatements ?? null}
      />
    </BorrowerShell>
  );
}
