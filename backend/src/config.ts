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
  const isWholePositive = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

  if (!isNonEmpty(c.brand?.name)) problems.push('brand.name is required');
  if (!isNonEmpty(c.locale)) problems.push('locale is required');
  if (!isNonEmpty(c.currency)) problems.push('currency is required');
  if (!isNonEmpty(c.timeZone)) problems.push('timeZone is required');

  if (!isWholePositive(c.borrower?.minimumStatementMonths)) {
    problems.push('borrower.minimumStatementMonths must be a positive whole number');
  }

  const reasons = c.declineReasons;
  if (!Array.isArray(reasons) || reasons.length === 0) {
    problems.push('declineReasons must list at least one reason');
  } else {
    if (new Set(reasons.map((r) => r.id)).size !== reasons.length) problems.push('declineReasons ids must be unique');
    if (!reasons.every((r) => isNonEmpty(r.id) && isNonEmpty(r.label) && Array.isArray(r.whatWouldChange))) {
      problems.push('each decline reason needs an id, a label and a whatWouldChange list');
    }
  }

  const p = c.pricing;
  if (!p) {
    problems.push('pricing is required');
    return problems;
  }
  if (!isPositive(p.apr) || p.apr >= CRIMINAL_RATE_CAP_APR) {
    problems.push(`pricing.apr must be above 0 and below ${CRIMINAL_RATE_CAP_APR}`);
  }
  if (!isWholePositive(p.termMonths)) problems.push('pricing.termMonths must be a positive whole number');
  const range = p.amountRange;
  if (!isWholePositive(range?.min) || !isWholePositive(range?.max) || range.min >= range.max) {
    problems.push('pricing.amountRange needs whole amounts with 0 < min < max');
  }
  return problems;
}
