import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  data: Array<Record<string, number | string>>;
  lines: Array<{ key: string; color: string; name: string }>;
  title: string;
  yAxisLabel?: string;
  formatValue?: (v: number) => string;
}

export default function WeeklyTrendChart({
  data,
  lines,
  title,
  yAxisLabel,
  formatValue = (v) => `${v}`,
}: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#94a3b8' } } : undefined}
          />
          <Tooltip
            formatter={(v: number | undefined) => [formatValue(v ?? 0)]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}
          />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2}
              dot={{ r: 3, fill: l.color, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              name={l.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
