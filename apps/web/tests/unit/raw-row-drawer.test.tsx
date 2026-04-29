/**
 * 단위 테스트 — `components/entity/raw-row-drawer.tsx`.
 *
 * 트리거 버튼 렌더 + 닫힌 상태에서 fetch가 호출되지 않음을 검증한다.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('RawRowDrawer', () => {
  it('renders trigger button labeled by prop', async () => {
    const { RawRowDrawer } = await import('@/components/entity/raw-row-drawer');
    render(<RawRowDrawer label="View raw" bn="107951618RR0001" lens="zombie" />);
    expect(screen.getByRole('button', { name: /view raw/i })).toBeInTheDocument();
  });

  it('does NOT fetch when drawer is closed (lazy)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ rows: [], sql: '', lens: 'zombie' }), {
        status: 200,
      }),
    );
    const { RawRowDrawer } = await import('@/components/entity/raw-row-drawer');
    render(<RawRowDrawer label="View raw" bn="107951618RR0001" lens="zombie" />);
    // 초기 렌더만으로는 fetch가 호출되면 안 된다.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('exposes accessible trigger with lens label in trigger context', async () => {
    const { RawRowDrawer } = await import('@/components/entity/raw-row-drawer');
    render(<RawRowDrawer label="Open ghost" bn="107951618RR0001" lens="ghost" />);
    const button = screen.getByRole('button');
    expect(button.textContent).toContain('Open ghost');
  });
});
