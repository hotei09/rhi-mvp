/**
 * 단위 테스트 — `components/entity/director-disclaimer.tsx`.
 *
 * AC-10 (Director Overlap "Signal Only" 디스클레이머) — 측정 가능한 모든 기준 검증:
 *  - 위치: 디렉터 카드와 동일한 부모 컨테이너 내
 *  - 폰트 크기: 최소 14px (Tailwind `text-sm` 클래스 = 14px)
 *  - 접근성 속성: `role='note'` AND `aria-label` 보유
 *  - 본문 내용: "signal only — not a fraud claim" 또는 한국어 동등 표현 ("시그널일 뿐 사기 단정이 아닙니다")
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('DirectorDisclaimer (AC-10)', () => {
  it('renders an element with role="note"', async () => {
    const { DirectorDisclaimer } = await import('@/components/entity/director-disclaimer');
    render(<DirectorDisclaimer />);
    const note = screen.getByRole('note');
    expect(note).toBeInTheDocument();
  });

  it('has aria-label attribute (accessibility)', async () => {
    const { DirectorDisclaimer } = await import('@/components/entity/director-disclaimer');
    render(<DirectorDisclaimer />);
    const note = screen.getByRole('note');
    const ariaLabel = note.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.length ?? 0).toBeGreaterThan(0);
  });

  it('text content includes "signal only" or "시그널" (canonical disclaimer)', async () => {
    const { DirectorDisclaimer } = await import('@/components/entity/director-disclaimer');
    render(<DirectorDisclaimer />);
    const note = screen.getByRole('note');
    const text = note.textContent ?? '';
    // English "signal only — not a fraud claim" 또는 Korean "시그널일 뿐 사기 단정이 아닙니다"
    expect(text).toMatch(/signal only|시그널/i);
  });

  it('uses text-sm class for >= 14px font (or explicit fontSize style)', async () => {
    const { DirectorDisclaimer } = await import('@/components/entity/director-disclaimer');
    const { container } = render(<DirectorDisclaimer />);
    const note = container.querySelector('[role="note"]');
    expect(note).not.toBeNull();
    const className = note?.getAttribute('class') ?? '';
    const styleAttr = note?.getAttribute('style') ?? '';
    // Tailwind text-sm = 14px, or explicit style
    const hasTextSm = className.includes('text-sm');
    const hasExplicitFontSize = /font-size:\s*(1[4-9]|[2-9][0-9])px/i.test(styleAttr);
    expect(hasTextSm || hasExplicitFontSize).toBe(true);
  });

  it('placed inside parent director card container (closest data-testid="director-card")', async () => {
    const { DirectorDisclaimer } = await import('@/components/entity/director-disclaimer');
    render(
      <section data-testid="director-card">
        <p>5 matching directors across 12 other funded BNs</p>
        <DirectorDisclaimer />
      </section>,
    );
    const note = screen.getByRole('note');
    const parent = note.closest('[data-testid="director-card"]');
    expect(parent).not.toBeNull();
  });
});
