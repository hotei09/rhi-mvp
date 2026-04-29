/**
 * Identity Block — REQ-004 entity profile 식별 정보 카드.
 *
 * cra_identification 기반 5개 필드 (legal_name, BN, category, registration_date, address)를
 * 카드 레이아웃으로 표시. Server Component.
 */
import { formatDate } from '@/lib/format/date';

/**
 * Identity block props — cra_identification 발췌.
 */
export type IdentityBlockProps = {
  bn: string;
  legal_name: string;
  category: string | null;
  designation: string | null;
  registration_date: string | null;
  address_line_1: string | null;
  city: string | null;
  province: string | null;
};

/**
 * designation 코드를 사람이 읽는 라벨로 매핑한다.
 * 출처: schema.md §2.2 (A=Public Foundation, B=Private Foundation, C=Charitable Org).
 */
function designationLabel(code: string | null): string {
  switch (code) {
    case 'A':
      return 'Public Foundation';
    case 'B':
      return 'Private Foundation';
    case 'C':
      return 'Charitable Organization';
    default:
      return code ?? '—';
  }
}

/**
 * Identity 카드 — 단체 식별 정보 표시.
 */
export function IdentityBlock({
  bn,
  legal_name,
  category,
  designation,
  registration_date,
  address_line_1,
  city,
  province,
}: IdentityBlockProps) {
  const addressParts = [address_line_1, city, province].filter(Boolean);
  const addressDisplay = addressParts.length > 0 ? addressParts.join(', ') : '—';

  return (
    <section data-testid="identity-block" className="rounded-lg border bg-card p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{legal_name}</h1>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">BN</dt>
          <dd className="mt-1 font-mono">{bn}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Category</dt>
          <dd className="mt-1">{category ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Designation</dt>
          <dd className="mt-1">{designationLabel(designation)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registration</dt>
          <dd className="mt-1">{registration_date ? formatDate(registration_date) : '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
          <dd className="mt-1">{addressDisplay}</dd>
        </div>
      </dl>
    </section>
  );
}
