/**
 * 단위 테스트 — `components/shared/methodology-popover.tsx`.
 *
 * Popover trigger button + 본문 텍스트 sanity 검증.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('MethodologyPopover', () => {
  it('renders trigger button', async () => {
    const { MethodologyPopover } = await import('@/components/shared/methodology-popover');
    render(<MethodologyPopover />);
    expect(screen.getByRole('button', { name: /methodology/i })).toBeInTheDocument();
  });

  it('trigger button has aria-label', async () => {
    const { MethodologyPopover } = await import('@/components/shared/methodology-popover');
    render(<MethodologyPopover />);
    const btn = screen.getByLabelText('methodology-popover');
    expect(btn).toBeInTheDocument();
  });
});
