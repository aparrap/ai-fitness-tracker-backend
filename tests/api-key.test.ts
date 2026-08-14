import { describe, expect, it } from 'vitest';
import { secureCompareApiKey } from '../src/shared/api-key.js';

describe('secureCompareApiKey', () => {
  const expected = 'a'.repeat(64);

  it('accepts an exact match', () => {
    expect(secureCompareApiKey(expected, expected)).toBe(true);
  });

  it('rejects an incorrect value', () => {
    expect(secureCompareApiKey('b'.repeat(64), expected)).toBe(false);
  });

  it('rejects a missing value', () => {
    expect(secureCompareApiKey(undefined, expected)).toBe(false);
  });
});
