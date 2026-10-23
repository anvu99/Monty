import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface TimelinePoint {
  id: string;
  date: string;
  score: number;
  product: string;
  amount: number;
  alertType: string;
}

interface Props {
  data: TimelinePoint[];
  onDotClick?: (point: TimelinePoint) => void;
}

function alertColor(type: string): string {
  if (type === 'impulse_pause') return '#E07A5F';
  if (type === 'gentle_nudge') return '#7E6AE6';
  if (type === 'celebrate') return '#11A39A';
  return '#94A3B8';
}

export default function ScoreTimelineChart({ data, onDotClick }: Props) {
  if (data.length === 0) return null;

  const avgScore = data.reduce((s, d) => s + d.score, 0) / data.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-coral-500" />
        <h2 className="font-display text-base font-semibold text-ink">Impulse Score Timeline</h2>
        <span className="ml-auto text-[10px] text-slate-400">
          Avg: <span className="font-mono font-semibold text-ink">{avgScore.toFixed(2)}</span>
        </span>
      </div>

      <div style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E07A5F" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#E07A5F" stopOpacity={0.02} />
              </linearGradient>
            </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 0.35, 0.6, 1]}
          />
          <ReferenceLine
            y={0.6}
            stroke="#E07A5F"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: 'Impulse', position: 'right', fontSize: 9, fill: '#E07A5F' }}
          />
          <ReferenceLine
            y={0.35}
            stroke="#11A39A"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
            label={{ value: 'Planned', position: 'right', fontSize: 9, fill: '#11A39A' }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#E07A5F"
            strokeWidth={2}
            fill="url(#scoreGrad)"
            isAnimationActive={false}
            dot={(props: Record<string, unknown>) => {
              const cx = props.cx as number | undefined;
              const cy = props.cy as number | undefined;
              const payload = props.payload as TimelinePoint | undefined;
              if (cx == null || cy == null || !payload) return <circle r={0} />;
              return (
                <g>
                  {/* Larger invisible hit area */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill="transparent"
                    style={{ cursor: onDotClick ? 'pointer' : undefined }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDotClick?.(payload);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDotClick?.(payload);
                    }}
                  />
                  {/* Visible dot */}
                  <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={alertColor(payload.alertType)}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{
                      pointerEvents: 'none'
                    }}
                  />
                </g>
              );
            }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as TimelinePoint;
              return (
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-card">
                  <p className="text-xs font-semibold text-ink">{d.product}</p>
                  <p className="font-mono text-[10px] text-slate-500">${d.amount.toFixed(2)}</p>
                  <p className="mt-1 font-mono text-xs">
                    Score:{' '}
                    <span className="font-bold" style={{ color: alertColor(d.alertType) }}>
                      {d.score.toFixed(2)}
                    </span>
                  </p>
                </div>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#E07A5F' }} />
          <span className="text-[9px] text-slate-500">Impulse Pause</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#7E6AE6' }} />
          <span className="text-[9px] text-slate-500">Gentle Nudge</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#11A39A' }} />
          <span className="text-[9px] text-slate-500">Celebrated</span>
        </div>
      </div>
    </div>
  );
}
