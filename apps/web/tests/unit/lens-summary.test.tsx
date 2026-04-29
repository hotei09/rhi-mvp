/**
 * 단위 테스트 — `components/entity/lens-summary.tsx`.
 *
 * 5개 lens 카드 + Director 카드 내 disclaimer 위치 검증.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const SAMPLE_PROPS = {
  bn: '107951618RR0001',
  zombie: { score: 60 as const, raw: null },
  ghost: { score: 30 as const, raw: null },
  loop: {
    loop_count: 2,
    tiers: { A: 1, B: 1, C: 0 },
    max_tier: 'B' as const,
  },
  director: { overlap_count: 5, matches: [] },
  multi_source: {
    source_count: 2 as const,
    fed_total: 1000000,
    ab_total: 500000,
    cra_govt_total: 750000,
    same_year_overlap: 1,
  },
};

describe('LensSummary', () => {
  it('renders 5 lens cards', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    const { container } = render(<LensSummary {...SAMPLE_PROPS} />);
    const articles = container.querySelectorAll('article[data-lens]');
    expect(articles.length).toBe(5);
  });

  it('Director disclaimer is inside director card (AC-10 location)', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(<LensSummary {...SAMPLE_PROPS} />);
    const note = screen.getByRole('note');
    const card = note.closest('[data-testid="director-card"]');
    expect(card).not.toBeNull();
  });

  it('renders Loop max_tier when loops exist', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(<LensSummary {...SAMPLE_PROPS} />);
    // Tier B 라벨이 표시되어야 함
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders dash when no loops', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(
      <LensSummary
        {...SAMPLE_PROPS}
        loop={{ loop_count: 0, tiers: { A: 0, B: 0, C: 0 }, max_tier: null }}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders zombie raw last_fpe when raw is present', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(
      <LensSummary
        {...SAMPLE_PROPS}
        zombie={{
          score: 80 as const,
          raw: {
            bn: '107951618RR0001',
            legal_name: 'Sample',
            last_funding_year: 2022,
            total_funding: 1000,
            last_fpe: '2023-12-31',
            months_since_filing: 12,
          },
        }}
      />,
    );
    expect(screen.getByText(/2023-12-31/)).toBeInTheDocument();
  });

  it('renders ghost program_ratio percentage when raw populated', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(
      <LensSummary
        {...SAMPLE_PROPS}
        ghost={{
          score: 80 as const,
          raw: {
            bn: '107951618RR0001',
            legal_name: 'Sample',
            govt_share: 0.85,
            govt_sum: 1000,
            program_ratio: 0.18,
            last_fpe: '2023-12-31',
            registration_date: '2010-01-01',
          },
        }}
      />,
    );
    expect(screen.getByText(/18\.0%/)).toBeInTheDocument();
  });

  it('renders no overlap when director matches empty', async () => {
    const { LensSummary } = await import('@/components/entity/lens-summary');
    render(<LensSummary {...SAMPLE_PROPS} director={{ overlap_count: 0, matches: [] }} />);
    expect(screen.getByText(/no overlap/i)).toBeInTheDocument();
  });
});
