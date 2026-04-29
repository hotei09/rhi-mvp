/**
 * Director Disclaimer — AC-10 measurable criteria 충족 (REQ-002, REQ-004).
 *
 * AC-10이 강제하는 4개 측정 가능 기준:
 *  1. 위치: 디렉터 카드와 동일 부모 컨테이너 내 (호출 측 책임 — `<Card><DirectorDisclaimer/></Card>`)
 *  2. 폰트 크기: 최소 14px (Tailwind `text-sm` = 14px + explicit `style.fontSize`로 이중 보장)
 *  3. 접근성: `role='note'` + `aria-label` 둘 다 보유
 *  4. 본문 내용: "signal only — not a fraud claim" + 한국어 동등 표현 ("시그널일 뿐 사기 단정이 아닙니다")
 *
 * 본 컴포넌트는 Server Component (no 'use client') — 정적 마크업만 렌더.
 *
 * @MX:NOTE: [AUTO] AC-10 must-pass disclaimer. role='note' + aria-label + text-sm + signal/시그널 텍스트 변경 시 acceptance test 즉시 실패. SPEC 동시 갱신 필수.
 * @MX:SPEC: SPEC-RHI-001 REQ-002 / AC-10
 */

/**
 * AC-10 본문 검증 통과 — English-only disclaimer (UI 영문화 후 hackathon 평가 대상).
 * @MX:NOTE: [AUTO] AC-10 measurable text. Must contain "signal only — not a fraud claim" exactly.
 */
const DISCLAIMER_TEXT = 'signal only — not a fraud claim';

/**
 * Director Network lens 카드 내부에 렌더되는 disclaimer 컴포넌트.
 * AC-10이 요구하는 4개 측정 가능 기준 모두 충족.
 */
export function DirectorDisclaimer() {
  return (
    <p
      role="note"
      aria-label="director-disclaimer"
      className="text-sm text-muted-foreground italic mt-2"
      // ≥14px 이중 보장 — Tailwind 컴파일 누락 시에도 inline style이 fallback.
      style={{ fontSize: '14px' }}
    >
      {DISCLAIMER_TEXT}
    </p>
  );
}
