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
import type { AggregatedResourceData } from '../../types';
import { UTILIZATION_COLORS } from '../../constants/validation';

interface UtilizationBarChartProps {
  data: AggregatedResourceData[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: AggregatedResourceData;
  }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const resource = payload[0].payload;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{resource.resourceName}</p>
      <p className="text-gray-700">
        Total Hours: <span className="font-medium">{resource.totalHours}</span>
      </p>
      <p className="text-gray-700">
        Category:{' '}
        <span
          className="font-medium"
          style={{ color: UTILIZATION_COLORS[resource.utilizationCategory] }}
        >
          {resource.utilizationCategory}
        </span>
      </p>
      {resource.projects.length > 0 && (
        <div className="mt-2 border-t border-gray-100 pt-2">
          <p className="text-gray-600 font-medium mb-1">Project Breakdown:</p>
          <ul className="space-y-0.5">
            {resource.projects.map((project) => (
              <li key={project.projectName} className="text-gray-600">
                {project.projectName}: <span className="font-medium">{project.hours}h</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function UtilizationBarChart({ data }: UtilizationBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Import timesheet data to view utilization charts</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="resourceName"
            angle={-45}
            textAnchor="end"
            interval={0}
            height={80}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="totalHours" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={UTILIZATION_COLORS[entry.utilizationCategory]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
