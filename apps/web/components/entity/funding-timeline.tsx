'use client';

import { formatCAD } from '@/lib/format/currency';
import { formatFiscalYear } from '@/lib/format/date';
/**
 * Funding Timeline — REQ-004 / AC-12.
 *
 * Recharts stacked bar chart로 FED + AB + CRA gov-transfers의 fiscal_year별 합계를 시각화한다.
 * 빈 데이터인 경우 대체 메시지 노출.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type FundingTimelinePoint = {
  fiscal_year: number;
  fed: number;
  ab: number;
  cra_govt: number;
};

export type FundingTimelineProps = {
  data: FundingTimelinePoint[];
};

/**
 * 차트 색상 — Tailwind palette 매핑. Recharts는 inline color string만 지원.
 */
const COLOR_FED = '#1d4ed8'; // blue-700
const COLOR_AB = '#b91c1c'; // red-700
const COLOR_CRA = '#15803d'; // green-700

/**
 * Funding timeline stacked bar — Client Component (Recharts는 브라우저 측 SVG 렌더 필수).
 */
export function FundingTimeline({ data }: FundingTimelineProps) {
  if (data.length === 0) {
    return (
      <section
        data-testid="funding-timeline-empty"
        className="rounded-lg border bg-card p-6 text-sm text-muted-foreground"
      >
        Funding timeline 데이터가 없습니다.
      </section>
    );
  }

  return (
    <section data-testid="funding-timeline" className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide">Funding Timeline</h3>
      <p className="text-xs text-muted-foreground">FED + AB + CRA gov-transfers per fiscal year</p>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fiscal_year" tickFormatter={(v: number) => formatFiscalYear(v)} />
            <YAxis tickFormatter={(v: number) => formatCAD(v, { compact: true })} />
            <Tooltip
              formatter={(value: number) => formatCAD(value)}
              labelFormatter={(label: number) => formatFiscalYear(label)}
            />
            <Legend />
            <Bar dataKey="fed" name="FED" stackId="funds" fill={COLOR_FED} />
            <Bar dataKey="ab" name="AB" stackId="funds" fill={COLOR_AB} />
            <Bar dataKey="cra_govt" name="CRA Gov-Transfers" stackId="funds" fill={COLOR_CRA} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
