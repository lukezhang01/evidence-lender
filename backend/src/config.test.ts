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

  it('requires an amount range with min below max', () => {
    const bad = { ...config, pricing: { ...config.pricing, amountRange: { min: 6000, max: 500 } } };
    assert.equal(validateProductConfig(bad).length, 1);
  });
});
