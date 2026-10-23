import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#11A39A', '#E07A5F', '#7E6AE6', '#0E6F6B', '#D1654B', '#C4B8FF'];

interface Props {
  categories: Record<string, { sum: number; count: number; mean: number }>;
}

export default function SpendingCategoryChart({ categories }: Props) {
  const data = Object.entries(categories).map(([name, values]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: values.sum,
    count: values.count,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white rounded-2xl shadow-card border border-slate-200 p-5">
      <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-1">Spending by Category</p>
      <p className="text-xs text-slate-400 mb-4">
        Last 30 days: <span className="font-mono text-ink font-medium">${total.toFixed(2)}</span>
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            paddingAngle={3}
            strokeWidth={0}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={(props: any) => `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number | undefined) => [`$${(v ?? 0).toFixed(2)}`, 'Spent']}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
