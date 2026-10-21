import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CRIMINAL_RATE_CAP_APR, loadProductConfig, validateProductConfig } from './config.ts';

describe('product config', () => {
  const config = loadProductConfig();

  it('loads and validates config/product.json', () => {
    assert.deepEqual(validateProductConfig(config), []);
  });

  it('keeps the APR under the criminal rate cap', () => {
    assert.ok(config.pricing.apr < CRIMINAL_RATE_CAP_APR);
    const atCap = { ...config, pricing: { ...config.pricing, apr: CRIMINAL_RATE_CAP_APR } };
    assert.equal(validateProductConfig(atCap).length, 1);
  });

  it('requires the default amount to be one of the options', () => {
    const bad = { ...config, borrower: { ...config.borrower, defaultAmount: 1 } };
    assert.equal(validateProductConfig(bad).length, 1);
  });
});
