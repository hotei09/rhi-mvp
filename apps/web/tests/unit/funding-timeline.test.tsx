/**
 * 단위 테스트 — `components/entity/funding-timeline.tsx`.
 *
 * Recharts SVG 렌더 자체를 검증하기보다, 빈 데이터 분기와 정상 데이터 분기를 모두 커버한다.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Recharts는 jsdom 환경에서 측정 API가 없어 ResponsiveContainer가 0폭이 됨.
// 차트 자체 렌더 검증은 E2E가 담당하며, 본 테스트는 컨테이너/empty 분기만 검증한다.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="recharts-container">{children}</div>
    ),
  };
});

describe('FundingTimeline', () => {
  it('renders empty-state section when data is empty', async () => {
    const { FundingTimeline } = await import('@/components/entity/funding-timeline');
    render(<FundingTimeline data={[]} />);
    expect(screen.getByTestId('funding-timeline-empty')).toBeInTheDocument();
  });

  it('renders funding-timeline section when data has rows', async () => {
    const { FundingTimeline } = await import('@/components/entity/funding-timeline');
    const data = [
      { fiscal_year: 2022, fed: 1000, ab: 0, cra_govt: 500 },
      { fiscal_year: 2023, fed: 0, ab: 200, cra_govt: 700 },
    ];
    render(<FundingTimeline data={data} />);
    expect(screen.getByTestId('funding-timeline')).toBeInTheDocument();
    expect(screen.getByText(/Funding Timeline/i)).toBeInTheDocument();
  });
});
