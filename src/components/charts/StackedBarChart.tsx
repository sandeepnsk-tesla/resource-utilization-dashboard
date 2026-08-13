/**
 * StackedBarChart - Shows resource contribution per month as stacked bars.
 * Each stack segment represents a Resource_Engineer's contribution,
 * color-coded by their UtilizationCategory.
 * Validates: Requirements 8.4
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { UTILIZATION_COLORS } from '../../constants/validation';
import type { AggregatedProjectData } from '../../types';
import type { UtilizationCategory } from '../../types/config';

export interface StackedBarEntry {
  month: string;
  [resourceName: string]: number | string;
}

interface StackedBarChartProps {
  /** Aggregated project data (one entry per month) */
  data: AggregatedProjectData[];
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: {
    name: string;
    value: number;
    color: string;
  }[];
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-w-xs">
      <p className="font-semibold text-gray-900 mb-2">{label}</p>
      <ul className="space-y-1">
        {payload
          .filter((entry) => entry.value > 0)
          .map((entry) => (
            <li key={entry.name} className="flex justify-between gap-3">
              <span className="text-gray-700 truncate">{entry.name}</span>
              <span className="font-medium text-gray-900">{entry.value.toFixed(1)}h</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function StackedBarChart({ data }: StackedBarChartProps) {
  // Transform AggregatedProjectData[] into chart-ready format
  const { chartData, resourceNames, categoryMap } = useMemo(() => {
    if (data.length === 0) {
      return { chartData: [] as StackedBarEntry[], resourceNames: [] as string[], categoryMap: {} as Record<string, UtilizationCategory> };
    }

    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    // Sort months chronologically
    const sortedMonths = [...data].sort((a, b) => {
      const yearDiff = a.year - b.year;
      if (yearDiff !== 0) return yearDiff;
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    // Get all unique resource names and category map
    const allResourceNames = new Set<string>();
    const catMap: Record<string, UtilizationCategory> = {};
    for (const monthData of sortedMonths) {
      for (const r of monthData.resources) {
        allResourceNames.add(r.resourceName);
        catMap[r.resourceName] = r.category;
      }
    }
    const resNames = Array.from(allResourceNames).sort();

    // Build chart data
    const entries: StackedBarEntry[] = sortedMonths.map((monthData) => {
      const entry: StackedBarEntry = { month: `${monthData.month} ${monthData.year}` };
      for (const r of monthData.resources) {
        entry[r.resourceName] = r.hours;
      }
      // Fill missing resources with 0
      for (const name of resNames) {
        if (!(name in entry)) {
          entry[name] = 0;
        }
      }
      return entry;
    });

    return { chartData: entries, resourceNames: resNames, categoryMap: catMap };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No project data available for stacked chart</p>
      </div>
    );
  }

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12 }}
            angle={-30}
            textAnchor="end"
            height={60}
          />
          <YAxis
            label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            wrapperStyle={{ paddingTop: '10px' }}
          />
          {resourceNames.map((resourceName) => (
            <Bar
              key={resourceName}
              dataKey={resourceName}
              stackId="resources"
              fill={UTILIZATION_COLORS[categoryMap[resourceName] || 'optimally-utilized']}
              name={resourceName}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
