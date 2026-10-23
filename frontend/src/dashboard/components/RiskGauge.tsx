import { motion } from 'framer-motion';
import { Shield, Zap } from 'lucide-react';
import type { ApiRiskFactor } from '@/api/client';

interface Props {
  score: number;
  riskLevel: string;
  factors: ApiRiskFactor[];
  variant?: 'parent' | 'kid';
}

function gaugeColor(score: number): string {
  if (score >= 70) return '#E07A5F';
  if (score >= 40) return '#F59E0B';
  return '#11A39A';
}

function riskLabel(level: string): string {
  if (level === 'high') return 'High Risk';
  if (level === 'moderate') return 'Moderate';
  return 'Low Risk';
}

function kidRiskLabel(score: number): string {
  if (score >= 70) return 'Stay alert!';
  if (score >= 40) return 'Looking OK';
  return 'You\'re doing great!';
}

export default function RiskGauge({ score, riskLevel, factors, variant = 'parent' }: Props) {
  const isKid = variant === 'kid';
  const color = gaugeColor(score);

  // SVG semicircle arc parameters
  const cx = 100;
  const cy = 90;
  const r = 70;
  const startAngle = Math.PI;
  const endAngle = 0;
  const fillAngle = startAngle - (score / 100) * Math.PI;

  const bgArcD = describeArc(cx, cy, r, endAngle, startAngle);
  const fillArcD = describeArc(cx, cy, r, fillAngle, startAngle);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        {isKid ? (
          <Zap className="h-4 w-4 text-lilac-500" />
        ) : (
          <Shield className="h-4 w-4 text-teal-700" />
        )}
        <h2 className="font-display text-base font-semibold text-ink">
          {isKid ? 'Your Impulse Shield' : 'Current Risk Score'}
        </h2>
      </div>

      {/* Gauge */}
      <div className="flex justify-center">
        <svg width="200" height="110" viewBox="0 0 200 110">
          {/* Background arc */}
          <path d={bgArcD} fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
          {/* Filled arc */}
          <motion.path
            d={fillArcD}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {/* Score text */}
          <text x={cx} y={cy - 10} textAnchor="middle" className="font-mono" fontSize="32" fontWeight="bold" fill={color}>
            {score}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#94A3B8" letterSpacing="0.1em">
            {isKid ? kidRiskLabel(score) : riskLabel(riskLevel)}
          </text>
        </svg>
      </div>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">Contributing Factors</p>
          {factors.map((f) => (
            <div key={f.factor} className="flex items-center gap-2">
              <div
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: gaugeColor(f.contribution) }}
              />
              <span className="flex-1 text-xs text-slate-600 truncate">{f.description}</span>
              <span className="font-mono text-[10px] text-slate-400 shrink-0">+{f.contribution}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: SVG arc path from angle to angle (radians, 0=right, PI=left)
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy - r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}
