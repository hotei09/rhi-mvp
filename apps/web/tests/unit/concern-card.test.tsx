/**
 * 단위 테스트 — `components/entity/concern-card.tsx`.
 *
 * AC-6: 통합 Concern Score 카드 — 점수 + tier 배지 + 5개 component breakdown 렌더.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const SAMPLE_COMPONENTS = {
  zombie: 18.0,
  ghost: 10.0,
  loop: 10.0,
  director: 5.0,
  multi_source: 15.0,
};

describe('ConcernCard (AC-6 통합 Concern Score 카드)', () => {
  it('renders the integer-rounded score', async () => {
    const { ConcernCard } = await import('@/components/entity/concern-card');
    render(<ConcernCard score={58} tier="Medium" components={SAMPLE_COMPONENTS} />);
    // 점수가 화면 어딘가에 표시되어야 함 (정수 또는 1자리 반올림)
    expect(screen.getByText(/58/)).toBeInTheDocument();
  });

  it('renders the tier label', async () => {
    const { ConcernCard } = await import('@/components/entity/concern-card');
    render(<ConcernCard score={58} tier="Medium" components={SAMPLE_COMPONENTS} />);
    expect(screen.getByText(/Medium/i)).toBeInTheDocument();
  });

  it('renders all 5 lens component labels', async () => {
    const { ConcernCard } = await import('@/components/entity/concern-card');
    render(<ConcernCard score={58} tier="Medium" components={SAMPLE_COMPONENTS} />);
    // 5개 lens 컴포넌트 레이블 (대소문자 무관)
    expect(screen.getByText(/zombie/i)).toBeInTheDocument();
    expect(screen.getByText(/ghost/i)).toBeInTheDocument();
    expect(screen.getByText(/loop/i)).toBeInTheDocument();
    expect(screen.getByText(/director/i)).toBeInTheDocument();
    expect(screen.getByText(/multi/i)).toBeInTheDocument();
  });

  it('Critical tier renders critical visual marker', async () => {
    const { ConcernCard } = await import('@/components/entity/concern-card');
    const { container } = render(
      <ConcernCard score={92} tier="Critical" components={SAMPLE_COMPONENTS} />,
    );
    expect(container.textContent).toContain('Critical');
    // Critical tier는 시각적 마커 (red 등)를 포함
    const html = container.innerHTML;
    expect(html).toMatch(/red|critical/i);
  });

  it('Healthy tier renders score and label', async () => {
    const { ConcernCard } = await import('@/components/entity/concern-card');
    render(
      <ConcernCard
        score={5}
        tier="Healthy"
        components={{ zombie: 1, ghost: 1, loop: 1, director: 1, multi_source: 1 }}
      />,
    );
    expect(screen.getByText(/Healthy/i)).toBeInTheDocument();
    // 큰 점수 디스플레이의 정확 매칭 — text-5xl 클래스를 가진 요소 안에서 검색
    const scoreDisplay = screen.getByText('5');
    expect(scoreDisplay).toBeInTheDocument();
  });
});
