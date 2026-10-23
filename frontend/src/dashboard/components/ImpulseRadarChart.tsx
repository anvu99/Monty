import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Hexagon } from 'lucide-react';

interface RadarDatum {
  factor: string;
  label: string;
  avgWeight: number;
  fullMark: number;
}

interface Props {
  data: RadarDatum[];
  onFactorClick?: (factorKey: string) => void;
}

export default function ImpulseRadarChart({ data, onFactorClick }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Hexagon className="h-4 w-4 text-coral-500" />
        <h2 className="font-display text-base font-semibold text-ink">Impulse Factor Profile</h2>
        <span className="ml-auto text-[10px] uppercase tracking-[0.3em] text-slate-400">Avg across all events</span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart
          data={data}
          cx="50%"
          cy="50%"
          outerRadius="72%"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(state: any) => {
            if (state?.activePayload?.[0] && onFactorClick) {
              const d = state.activePayload[0].payload as RadarDatum;
              onFactorClick(d.factor);
            }
          }}
          style={onFactorClick ? { cursor: 'pointer' } : undefined}
        >
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748B' }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 1]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Impulse Weight"
            dataKey="avgWeight"
            stroke="#E07A5F"
            fill="#E07A5F"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as RadarDatum;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card">
                  <p className="text-xs font-semibold text-ink">{d.label}</p>
                  <p className="font-mono text-xs text-slate-600">
                    Avg: <span className="font-bold" style={{ color: d.avgWeight >= 0.6 ? '#E07A5F' : d.avgWeight >= 0.35 ? '#F59E0B' : '#11A39A' }}>{d.avgWeight.toFixed(2)}</span>
                  </p>
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <div
            key={d.factor}
            className={`flex items-center gap-2 ${onFactorClick ? 'cursor-pointer hover:bg-slate-50 rounded px-1 -mx-1' : ''}`}
            onClick={() => onFactorClick?.(d.factor)}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: d.avgWeight >= 0.6 ? '#E07A5F' : d.avgWeight >= 0.35 ? '#F59E0B' : '#11A39A' }}
            />
            <span className="text-[10px] text-slate-500">
              {d.label}: <span className="font-mono font-semibold text-ink">{d.avgWeight.toFixed(2)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
