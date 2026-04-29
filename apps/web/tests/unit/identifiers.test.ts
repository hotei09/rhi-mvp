/**
 * 단위 테스트 — `lib/domain/identifiers.ts` BN 식별자 정규화/검증.
 *
 * normalizeBn, bnRoot, validateBn 결정론적 동작 검증.
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/domain/identifiers — normalizeBn', () => {
  it('strips non-alphanumeric characters and uppercases', async () => {
    const { normalizeBn } = await import('@/lib/domain/identifiers');
    expect(normalizeBn('124072513RR0010')).toBe('124072513RR0010');
    expect(normalizeBn('124-072-513 RR0010')).toBe('124072513RR0010');
    expect(normalizeBn(' 124072513 rr0010 ')).toBe('124072513RR0010');
    expect(normalizeBn('124072513rr0010')).toBe('124072513RR0010');
  });

  it('preserves canonical numeric-only form', async () => {
    const { normalizeBn } = await import('@/lib/domain/identifiers');
    expect(normalizeBn('107951618')).toBe('107951618');
    expect(normalizeBn('107951618RR0001')).toBe('107951618RR0001');
  });

  it('returns empty string for completely invalid input', async () => {
    const { normalizeBn } = await import('@/lib/domain/identifiers');
    expect(normalizeBn('')).toBe('');
    expect(normalizeBn('---')).toBe('');
  });
});

describe('lib/domain/identifiers — bnRoot', () => {
  it('returns first 9 numeric chars (BN root)', async () => {
    const { bnRoot } = await import('@/lib/domain/identifiers');
    expect(bnRoot('124072513RR0010')).toBe('124072513');
    expect(bnRoot('107951618RR0001')).toBe('107951618');
    expect(bnRoot('107951618')).toBe('107951618');
  });

  it('handles already-normalized BN', async () => {
    const { bnRoot } = await import('@/lib/domain/identifiers');
    // 정규화 후 9자리 prefix 추출
    expect(bnRoot('124-072-513RR0010')).toBe('124072513');
  });

  it('returns shorter string when BN has fewer than 9 chars', async () => {
    const { bnRoot } = await import('@/lib/domain/identifiers');
    expect(bnRoot('12345')).toBe('12345');
  });
});

describe('lib/domain/identifiers — validateBn', () => {
  it('accepts canonical 9-digit BN', async () => {
    const { validateBn } = await import('@/lib/domain/identifiers');
    expect(validateBn('107951618')).toBe(true);
  });

  it('accepts 9-digit BN + RR + 4-digit suffix (15 chars total)', async () => {
    const { validateBn } = await import('@/lib/domain/identifiers');
    expect(validateBn('124072513RR0010')).toBe(true);
    expect(validateBn('107951618RR0001')).toBe(true);
  });

  it('rejects non-numeric or malformed input', async () => {
    const { validateBn } = await import('@/lib/domain/identifiers');
    expect(validateBn('')).toBe(false);
    expect(validateBn('ABC')).toBe(false);
    expect(validateBn('12345')).toBe(false); // 9자리 미만
  });
});
