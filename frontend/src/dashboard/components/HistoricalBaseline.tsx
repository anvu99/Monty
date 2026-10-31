interface Props {
  historicalAssessmentUsed?: boolean;
  score?: number | null;
  className?: string;
}

export default function HistoricalBaseline({ historicalAssessmentUsed, score, className }: Props) {
  if (historicalAssessmentUsed !== true || typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    return null;
  }
  return <p className={className}>ML baseline: {score}/100</p>;
}
