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
        No funding timeline data available.
      </section>
    );
  }

  return (
    <section
      data-testid="funding-timeline"
      className="rounded-xl border border-slate-200 bg-white p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Funding timeline
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Stacked yearly totals across federal, Alberta, and CRA-reported government transfers
            (last 10 fiscal years).
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-700" aria-hidden />
            FED
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-700" aria-hidden />
            AB
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-700" aria-hidden />
            CRA
          </span>
        </div>
      </div>
      <div className="mt-5 h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="fiscal_year"
              tickFormatter={(v: number) => formatFiscalYear(v)}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(v: number) => formatCAD(v, { compact: true })}
              stroke="#64748b"
              fontSize={12}
            />
            <Tooltip
              formatter={(value: number) => formatCAD(value)}
              labelFormatter={(label: number) => formatFiscalYear(label)}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="fed" name="FED" stackId="funds" fill={COLOR_FED} />
            <Bar dataKey="ab" name="AB" stackId="funds" fill={COLOR_AB} />
            <Bar dataKey="cra_govt" name="CRA Gov-Transfers" stackId="funds" fill={COLOR_CRA} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
