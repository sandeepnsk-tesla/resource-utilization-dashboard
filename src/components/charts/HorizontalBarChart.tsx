import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface HorizontalBarChartDataItem {
  projectName: string;
  hours: number;
}

interface HorizontalBarChartProps {
  data: HorizontalBarChartDataItem[];
}

/** Indigo/blue color for per-project hour bars */
const BAR_COLOR = '#4F46E5';

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: HorizontalBarChartDataItem;
  }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{item.projectName}</p>
      <p className="text-gray-700">
        Hours: <span className="font-medium">{item.hours}</span>
      </p>
    </div>
  );
}

export function HorizontalBarChart({ data }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No project data available for this resource</p>
      </div>
    );
  }

  // Calculate dynamic height based on number of projects (min 200px, 40px per bar)
  const chartHeight = Math.max(200, data.length * 40 + 60);

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 60, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            label={{ value: 'Hours', position: 'insideBottom', offset: -5 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="projectName"
            width={120}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="hours"
            radius={[0, 4, 4, 0]}
            label={{ position: 'right', fontSize: 12, fill: '#374151' }}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
