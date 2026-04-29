/**
 * 통화 포맷터 — CAD 기준 (en-CA locale).
 *
 * Entity profile 페이지의 funding timeline / identity block / lens summary 카드에서
 * 일관된 표기를 위해 module-level Intl.NumberFormat 인스턴스를 재사용한다.
 */

/**
 * 표준 CAD 포맷터 — `$1,234,567.00` 형식.
 * Module-level singleton — instance 재사용으로 불필요한 객체 생성 회피.
 */
const CAD_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Compact CAD 포맷터 — `$1.2M` / `$345K` 형식 (large funding amount용).
 */
const CAD_COMPACT_FORMATTER = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/**
 * 일반 숫자 포맷터 — comma separator 적용.
 */
const NUMBER_FORMATTER = new Intl.NumberFormat('en-CA', {
  maximumFractionDigits: 0,
});

/**
 * CAD 통화 포맷터 옵션.
 */
export type FormatCADOptions = {
  /** 큰 숫자를 1.2M / 345K 형식으로 압축. */
  compact?: boolean;
};

/**
 * 숫자를 CAD 통화 표기로 변환한다.
 *
 * @param amount - 변환할 금액 (CAD)
 * @param options - 포맷 옵션 (compact 등)
 * @returns "$1,234,567.00" 또는 "$1.2M" 형식 문자열
 *
 * @example
 *   formatCAD(1234567)             // "$1,234,567.00"
 *   formatCAD(1234567, { compact: true }) // "$1.2M"
 */
export function formatCAD(amount: number, options?: FormatCADOptions): string {
  if (options?.compact) {
    return CAD_COMPACT_FORMATTER.format(amount);
  }
  return CAD_FORMATTER.format(amount);
}

/**
 * 일반 숫자를 comma separator 표기로 변환한다.
 *
 * @param n - 변환할 숫자
 * @returns "1,234,567" 형식 문자열
 */
export function formatNumber(n: number): string {
  return NUMBER_FORMATTER.format(n);
}
