/**
 * 날짜 포맷터 — fiscal year + locale-aware date 표기.
 *
 * Entity profile 페이지의 funding timeline x-축 라벨, registration_date 표기에 사용.
 */

/**
 * 회계연도(int)를 "FY YYYY" 표기로 변환한다.
 *
 * @param year - 회계연도 (예: 2024)
 * @returns "FY 2024" 형식
 *
 * @example
 *   formatFiscalYear(2024) // "FY 2024"
 */
export function formatFiscalYear(year: number): string {
  return `FY ${year}`;
}

/**
 * Locale-aware 날짜 표기 변환기 — en-CA 기준.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/**
 * Date 객체 또는 ISO 문자열을 locale-aware 표기로 변환한다.
 * Invalid input은 빈 문자열 반환.
 *
 * @param d - Date 객체 또는 ISO 문자열 ("YYYY-MM-DD" 등)
 * @returns 포맷된 날짜 문자열 (en-CA)
 *
 * @example
 *   formatDate('2024-06-15')        // "Jun 15, 2024"
 *   formatDate(new Date(2024, 5, 15)) // "Jun 15, 2024"
 */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  return DATE_FORMATTER.format(date);
}
