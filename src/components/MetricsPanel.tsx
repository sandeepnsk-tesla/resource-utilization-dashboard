/**
 * MetricsPanel component — displays the top 5 key resource metrics.
 *
 * Shows average utilization %, over-utilized count, under-utilized count,
 * available capacity hours, and highest utilized resource name.
 * Each metric includes a trend indicator comparing to previous month data.
 *
 * Validates: Requirements 12.1, 12.3, 12.4, 12.5
 */

import { useDashboardMetrics, useFilteredResourceData } from '../state/selectors';
import type { MetricWithTrend } from '../logic/metricsCalculator';

/** Configuration for displaying a single metric card */
interface MetricCardConfig {
  key: string;
  label: string;
  format: (value: number | string) => string;
}

/** The 5 metrics to display with their labels and formatting */
const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: 'averageUtilizationPercentage',
    label: 'Avg Utilization',
    format: (v) => `${v}%`,
  },
  {
    key: 'overUtilizedCount',
    label: 'Over-Utilized',
    format: (v) => String(v),
  },
  {
    key: 'underUtilizedCount',
    label: 'Under-Utilized',
    format: (v) => String(v),
  },
  {
    key: 'totalAvailableCapacityHours',
    label: 'Available Capacity',
    format: (v) => `${v} hrs`,
  },
  {
    key: 'highestUtilizedResource',
    label: 'Highest Utilized',
    format: (v) => String(v) || '—',
  },
];

/** Renders the trend indicator arrow or dash */
function TrendIndicator({ trend }: { trend: MetricWithTrend['trend'] }) {
  if (trend === null) return null;

  if (trend === 'up') {
    return (
      <span className="text-green-600 text-sm font-medium" aria-label="Trend up">
        ↑
      </span>
    );
  }

  if (trend === 'down') {
    return (
      <span className="text-red-600 text-sm font-medium" aria-label="Trend down">
        ↓
      </span>
    );
  }

  // neutral
  return (
    <span className="text-gray-400 text-sm font-medium" aria-label="Trend neutral">
      —
    </span>
  );
}

/** MetricsPanel — reads from context via hooks, no props needed */
export function MetricsPanel() {
  const metrics = useDashboardMetrics();
  const filteredData = useFilteredResourceData();

  // Count unique resources in filtered data
  const uniqueResources = new Set(
    filteredData.map((r) => r.resourceName.toLowerCase())
  );
  const resourceCount = uniqueResources.size;

  // Requirement 12.5: Show message when fewer than 2 resources
  if (resourceCount < 2) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        <p>Import data for at least 2 resources to view meaningful metrics</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {METRIC_CARDS.map((card) => {
        const metric = metrics[card.key as keyof typeof metrics] as MetricWithTrend;

        return (
          <div
            key={card.key}
            className="bg-white rounded-lg shadow p-4 flex flex-col gap-1"
          >
            <span className="text-sm text-gray-500">{card.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {card.format(metric.value)}
              </span>
              <TrendIndicator trend={metric.trend} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MetricsPanel;
