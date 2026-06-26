import { describe, it, expect } from 'vitest';
import { claimableEraRange, unclaimedPages } from '../src/claim-engine';

describe('claimableEraRange', () => {
  it('applies the grace period to the upper bound and history depth to the lower bound', () => {
    expect(claimableEraRange(1000, 84, 16)).toEqual({ lower: 916, upper: 983 });
  });

  it('claims up to activeEra-1 with no grace period', () => {
    expect(claimableEraRange(1000, 84, 0)).toEqual({ lower: 916, upper: 999 });
  });

  it('clamps the lower bound at era 0', () => {
    expect(claimableEraRange(10, 84, 0)).toEqual({ lower: 0, upper: 9 });
  });

  it('yields an empty range when the grace period covers the whole window', () => {
    const { lower, upper } = claimableEraRange(100, 84, 100);
    expect(upper).toBeLessThan(lower);
  });
});

describe('unclaimedPages', () => {
  it('returns every page when none are claimed', () => {
    expect(unclaimedPages(3, [])).toEqual([0, 1, 2]);
  });

  it('skips already-claimed pages', () => {
    expect(unclaimedPages(4, [0, 2])).toEqual([1, 3]);
  });

  it('returns nothing when all pages are claimed', () => {
    expect(unclaimedPages(2, [0, 1])).toEqual([]);
  });

  it('returns nothing for a validator with no exposure pages', () => {
    expect(unclaimedPages(0, [])).toEqual([]);
  });
});
