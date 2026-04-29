/**
 * BN (Business Number) 식별자 정규화 / 검증 헬퍼.
 *
 * BN 형식:
 *  - 9자리 숫자: "107951618" (canonical root)
 *  - 9자리 숫자 + RR + 4자리 (15자): "107951618RR0001" (charity sub-account)
 *  - 정규화: 모든 비-알파누메릭 제거 + 대문자
 */

/**
 * 입력 문자열에서 비-알파누메릭 문자(공백, 하이픈 등)를 제거하고 대문자로 변환한다.
 * 빈 결과 또는 완전히 잘못된 입력은 빈 문자열 반환.
 *
 * @param bn - 정규화 대상 BN 문자열
 * @returns 정규화된 BN (예: "124-072-513 rr0010" → "124072513RR0010")
 */
export function normalizeBn(bn: string): string {
  if (!bn || typeof bn !== 'string') return '';
  return bn.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * 정규화된 BN의 첫 9자리(BN root prefix)를 반환한다.
 * Salvation Army 등 동일 root를 공유하는 sub-account 그룹화에 사용.
 *
 * @param bn - BN 문자열 (정규화 자동 적용)
 * @returns 9자리 prefix (BN이 9자리 미만이면 전체)
 */
export function bnRoot(bn: string): string {
  const normalized = normalizeBn(bn);
  return normalized.slice(0, 9);
}

/**
 * BN 형식 검증: 9자리 숫자 또는 9자리 숫자 + RR + 4자리(15자).
 *
 * @param bn - 검증 대상 BN
 * @returns true if BN이 canonical 형식 매칭
 */
export function validateBn(bn: string): boolean {
  if (!bn || typeof bn !== 'string') return false;
  const normalized = normalizeBn(bn);
  // 9자리 숫자 단독 또는 9자리 숫자 + RR + 4자리 숫자
  return /^[0-9]{9}(RR[0-9]{4})?$/.test(normalized);
}
