import type { Offer, ProductConfig } from './contract.ts';

const roundCents = (n: number) => Math.round(n * 100) / 100;

// Level monthly payments on a fixed APR, compounded monthly. Illustrative, like
// the pricing it reads (docs/HANDOFF.md section 8): all-in APR with fees is a
// business and legal decision.
export function quote(amount: number, pricing: ProductConfig['pricing']): Offer {
  const monthlyRate = pricing.apr / 12;
  const n = pricing.termMonths;
  const monthlyPayment = roundCents((amount * monthlyRate) / (1 - (1 + monthlyRate) ** -n));
  return {
    amount,
    termMonths: n,
    apr: pricing.apr,
    monthlyPayment,
    totalCostOfBorrowing: roundCents(monthlyPayment * n - amount),
    stepUp: { ...pricing.stepUp },
  };
}
