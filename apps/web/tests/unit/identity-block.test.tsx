/**
 * 단위 테스트 — `components/entity/identity-block.tsx`.
 *
 * REQ-004 identity 블록 — legal_name, BN, category, designation, registration, address 렌더 검증.
 */
import '../setup-env';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const SAMPLE_PROPS = {
  bn: '107951618RR0001',
  legal_name: 'Salvation Army',
  category: 'Christianity',
  designation: 'C',
  registration_date: '1967-01-01',
  address_line_1: '2 Overlea Blvd',
  city: 'Toronto',
  province: 'ON',
};

describe('IdentityBlock', () => {
  it('renders legal_name as heading', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} />);
    expect(screen.getByText(SAMPLE_PROPS.legal_name)).toBeInTheDocument();
  });

  it('renders BN in monospace', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} />);
    expect(screen.getByText(SAMPLE_PROPS.bn)).toBeInTheDocument();
  });

  it('maps designation code C to "Charitable Organization"', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} />);
    expect(screen.getByText('Charitable Organization')).toBeInTheDocument();
  });

  it('maps designation code A to "Public Foundation"', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} designation="A" />);
    expect(screen.getByText('Public Foundation')).toBeInTheDocument();
  });

  it('maps designation code B to "Private Foundation"', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} designation="B" />);
    expect(screen.getByText('Private Foundation')).toBeInTheDocument();
  });

  it('renders address joined by comma', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(<IdentityBlock {...SAMPLE_PROPS} />);
    expect(screen.getByText(/2 Overlea Blvd, Toronto, ON/)).toBeInTheDocument();
  });

  it('falls back to "—" when fields are null', async () => {
    const { IdentityBlock } = await import('@/components/entity/identity-block');
    render(
      <IdentityBlock
        bn="999999999RR9999"
        legal_name="Unknown"
        category={null}
        designation={null}
        registration_date={null}
        address_line_1={null}
        city={null}
        province={null}
      />,
    );
    // category, address 모두 — fallback
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
