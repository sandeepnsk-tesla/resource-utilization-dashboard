import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Label,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import type { AggregatedResourceData } from '../../types';
import type { UtilizationCategory } from '../../types/config';
import { UTILIZATION_COLORS } from '../../constants/validation';

interface DistributionDonutChartProps {
  data: AggregatedResourceData[];
}

interface DistributionSegment {
  name: string;
  value: number;
  category: UtilizationCategory;
  percentage: number;
}

const CATEGORY_LABELS: Record<UtilizationCategory, string> = {
  'over-utilized': 'Over-Utilized',
  'under-utilized': 'Under-Utilized',
  'optimally-utilized': 'Optimally Utilized',
};

function computeDistribution(data: AggregatedResourceData[]): DistributionSegment[] {
  const counts: Record<UtilizationCategory, number> = {
    'over-utilized': 0,
    'under-utilized': 0,
    'optimally-utilized': 0,
  };

  for (const resource of data) {
    counts[resource.utilizationCategory]++;
  }

  const total = data.length;

  const categories: UtilizationCategory[] = [
    'over-utilized',
    'under-utilized',
    'optimally-utilized',
  ];

  return categories
    .filter((category) => counts[category] > 0)
    .map((category) => ({
      name: CATEGORY_LABELS[category],
      value: counts[category],
      category,
      percentage: Math.round((counts[category] / total) * 1000) / 10,
    }));
}

const RADIAN = Math.PI / 180;

function renderCustomLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percentage = (props as unknown as { percentage: number }).percentage ?? 0;

  const radius = innerRadius + (outerRadius - innerRadius) * 1.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={12}
      fontWeight={500}
    >
      {`${percentage.toFixed(1)}%`}
    </text>
  );
}

interface CenterLabelProps {
  viewBox?: { cx: number; cy: number };
  total: number;
}

function CenterLabel({ viewBox, total }: CenterLabelProps) {
  const cx = viewBox?.cx ?? 0;
  const cy = viewBox?.cy ?? 0;

  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-900"
        fontSize={20}
        fontWeight={700}
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-gray-500"
        fontSize={12}
      >
        Resources
      </text>
    </g>
  );
}

export function DistributionDonutChart({ data }: DistributionDonutChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No data to display</p>
      </div>
    );
  }

  const distribution = computeDistribution(data);
  const total = data.length;

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={distribution}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            label={renderCustomLabel}
            labelLine={false}
          >
            {distribution.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={UTILIZATION_COLORS[entry.category]}
              />
            ))}
            <Label
              content={<CenterLabel total={total} />}
              position="center"
            />
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-sm text-gray-700">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
