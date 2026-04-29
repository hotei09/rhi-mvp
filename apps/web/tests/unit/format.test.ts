/**
 * 단위 테스트 — `lib/format/currency.ts` 와 `lib/format/date.ts` 포맷터 헬퍼.
 *
 * AC-12 보조 — entity profile 페이지에서 funding timeline / identity block 렌더 시
 * 통화/연도 표기를 결정론적으로 출력하는지 검증.
 */
import '../setup-env';
import { describe, expect, it } from 'vitest';

describe('lib/format/currency — formatCAD', () => {
  it('formats large CAD amount with comma separators', async () => {
    const { formatCAD } = await import('@/lib/format/currency');
    const result = formatCAD(1234567);
    expect(result).toContain('1,234,567');
    expect(result).toContain('$');
  });

  it('formats zero as $0', async () => {
    const { formatCAD } = await import('@/lib/format/currency');
    const result = formatCAD(0);
    expect(result).toContain('0');
    expect(result).toContain('$');
  });

  it('formats compact 1.2M when compact option set', async () => {
    const { formatCAD } = await import('@/lib/format/currency');
    const result = formatCAD(1_234_567, { compact: true });
    // Intl en-CA compact returns "$1.2M" or similar
    expect(result).toMatch(/\$1\.[0-9]+M/);
  });

  it('handles negative amounts gracefully', async () => {
    const { formatCAD } = await import('@/lib/format/currency');
    const result = formatCAD(-1234);
    expect(result).toContain('1,234');
    expect(result).toMatch(/-|\(/); // either "-$1,234" or "($1,234)"
  });
});

describe('lib/format/currency — formatNumber', () => {
  it('formats with comma separators', async () => {
    const { formatNumber } = await import('@/lib/format/currency');
    expect(formatNumber(1234567)).toContain('1,234,567');
  });
});

describe('lib/format/date — formatFiscalYear', () => {
  it('formats 2024 as "FY 2024"', async () => {
    const { formatFiscalYear } = await import('@/lib/format/date');
    expect(formatFiscalYear(2024)).toBe('FY 2024');
  });

  it('formats 2018 as "FY 2018"', async () => {
    const { formatFiscalYear } = await import('@/lib/format/date');
    expect(formatFiscalYear(2018)).toBe('FY 2018');
  });
});

describe('lib/format/date — formatDate', () => {
  it('formats Date object to locale string', async () => {
    const { formatDate } = await import('@/lib/format/date');
    const d = new Date('2024-06-15T00:00:00Z');
    const result = formatDate(d);
    expect(result).toMatch(/2024/);
  });

  it('formats ISO string', async () => {
    const { formatDate } = await import('@/lib/format/date');
    const result = formatDate('2024-06-15');
    expect(result).toMatch(/2024/);
  });
});
