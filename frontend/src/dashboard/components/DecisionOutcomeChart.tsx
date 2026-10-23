import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { GitBranch } from 'lucide-react';

interface ChartDatum {
  name: string;
  rawKey?: string;
  value: number;
  color: string;
}

interface Props {
  outcomeData: ChartDatum[];
  responseData: ChartDatum[];
  totalDecisions: number;
  onOutcomeClick?: (rawKey: string) => void;
  onResponseClick?: (rawKey: string) => void;
}

export default function DecisionOutcomeChart({ outcomeData, responseData, totalDecisions, onOutcomeClick, onResponseClick }: Props) {
  if (totalDecisions === 0) return null;

  const waitedCount = responseData.find((d) => d.name === 'Waited')?.value ?? 0;
  const waitedPct = totalDecisions > 0 ? Math.round((waitedCount / totalDecisions) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-lilac-500" />
        <h2 className="font-display text-base font-semibold text-ink">Decision Outcomes</h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
          {totalDecisions} events
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Donut: Decision Types */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">Decision Types</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={outcomeData}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                dataKey="value"
                stroke="none"
              >
                {outcomeData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    cursor={onOutcomeClick ? 'pointer' : undefined}
                    onClick={() => entry.rawKey && onOutcomeClick?.(entry.rawKey)}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ChartDatum;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card text-xs">
                      <span className="font-semibold text-ink">{d.name}</span>: {d.value}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {outcomeData.map((d) => (
              <div
                key={d.name}
                className={`flex items-center gap-2 ${d.rawKey && onOutcomeClick ? 'cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1' : ''}`}
                onClick={() => d.rawKey && onOutcomeClick?.(d.rawKey)}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-slate-600">{d.name}</span>
                <span className="ml-auto font-mono text-[10px] font-semibold text-ink">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar: Child Responses */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-slate-500">Child Responses</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={responseData} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={64}
                tick={{ fontSize: 10, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {responseData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    cursor={onResponseClick ? 'pointer' : undefined}
                    onClick={() => entry.rawKey && onResponseClick?.(entry.rawKey)}
                  />
                ))}
              </Bar>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ChartDatum;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card text-xs">
                      <span className="font-semibold text-ink">{d.name}</span>: {d.value}
                    </div>
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {responseData.map((d) => (
              <div
                key={d.name}
                className={`flex items-center gap-2 ${d.rawKey && onResponseClick ? 'cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1' : ''}`}
                onClick={() => d.rawKey && onResponseClick?.(d.rawKey)}
              >
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-[10px] text-slate-600">{d.name}</span>
                <span className="ml-auto font-mono text-[10px] font-semibold text-ink">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insight line */}
      <div className="mt-4 rounded-xl bg-teal-500/5 border border-teal-500/15 px-4 py-2.5 text-center">
        <p className="text-xs text-teal-700">
          {waitedPct > 0
            ? <>Waited <span className="font-mono font-bold">{waitedPct}%</span> of the time when prompted</>
            : 'No wait responses recorded yet'}
        </p>
      </div>
    </div>
  );
}
