import { readFileSync } from 'node:fs';
import type { ProductConfig } from './contract.ts';

// Canada's criminal interest rate cap, in force since January 1, 2025
// (docs/HANDOFF.md section 9). All-in pricing must stay under it.
export const CRIMINAL_RATE_CAP_APR = 0.35;

const CONFIG_URL = new URL('../config/product.json', import.meta.url);

export function loadProductConfig(url: URL = CONFIG_URL): ProductConfig {
  const config = JSON.parse(readFileSync(url, 'utf8')) as ProductConfig;
  const problems = validateProductConfig(config);
  if (problems.length > 0) {
    throw new Error(`Invalid product config (${url.pathname}):\n- ${problems.join('\n- ')}`);
  }
  return config;
}

export function validateProductConfig(c: ProductConfig): string[] {
  const problems: string[] = [];
  const isPositive = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  const isNonEmpty = (s: unknown) => typeof s === 'string' && s.trim().length > 0;

  if (!isNonEmpty(c.brand?.name)) problems.push('brand.name is required');
  if (!isNonEmpty(c.locale)) problems.push('locale is required');
  if (!isNonEmpty(c.currency)) problems.push('currency is required');
  if (!isNonEmpty(c.timeZone)) problems.push('timeZone is required');

  const options = c.borrower?.amountOptions;
  if (!Array.isArray(options) || options.length === 0 || !options.every(isPositive)) {
    problems.push('borrower.amountOptions must be a non-empty list of positive amounts');
  } else if (!options.includes(c.borrower.defaultAmount)) {
    problems.push('borrower.defaultAmount must be one of borrower.amountOptions');
  }

  const p = c.pricing;
  if (!p) {
    problems.push('pricing is required');
    return problems;
  }
  if (!isPositive(p.apr) || p.apr >= CRIMINAL_RATE_CAP_APR) {
    problems.push(`pricing.apr must be above 0 and below ${CRIMINAL_RATE_CAP_APR}`);
  }
  if (!Number.isInteger(p.termMonths) || p.termMonths <= 0) {
    problems.push('pricing.termMonths must be a positive whole number');
  }
  if (!isPositive(p.starterLimit)) problems.push('pricing.starterLimit must be positive');
  if (!Number.isInteger(p.stepUp?.onTimePayments) || p.stepUp.onTimePayments <= 0) {
    problems.push('pricing.stepUp.onTimePayments must be a positive whole number');
  }
  if (!isPositive(p.stepUp?.limit) || p.stepUp.limit < p.starterLimit) {
    problems.push('pricing.stepUp.limit must be at least pricing.starterLimit');
  }
  const range = p.reviewerAdjustRange;
  if (!isPositive(range?.min) || !isPositive(range?.max) || range.min >= range.max) {
    problems.push('pricing.reviewerAdjustRange needs 0 < min < max');
  }
  return problems;
}
