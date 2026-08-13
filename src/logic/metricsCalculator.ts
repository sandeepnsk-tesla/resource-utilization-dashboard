/**
 * Metrics Calculator Module
 *
 * Computes the top 5 dashboard metrics and trend indicators by comparing
 * current month data against previous month data.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import type { AggregatedResourceData } from '../types/index';

/** Dashboard metrics values */
export interface DashboardMetrics {
  /** Total hours / total effective hours * 100, rounded to 1 decimal */
  averageUtilizationPercentage: number;
  /** Count of resources classified as over-utilized */
  overUtilizedCount: number;
  /** Count of resources classified as under-utilized */
  underUtilizedCount: number;
  /** Sum of (effective hours - actual hours) for all resources */
  totalAvailableCapacityHours: number;
  /** Name of resource with highest total hours (alphabetical tiebreaker) */
  highestUtilizedResource: string;
}

/** A metric value paired with its trend indicator */
export interface MetricWithTrend {
  value: number | string;
  /** 'up' = improved, 'down' = worsened, 'neutral' = unchanged, null = no previous data */
  trend: 'up' | 'down' | 'neutral' | null;
}

/** Result of metrics calculation: each metric paired with a trend */
export type MetricsResult = Record<keyof DashboardMetrics, MetricWithTrend>;

/**
 * Calculates the average utilization percentage from aggregated resource data.
 * Formula: sum(totalHours) / sum(effectiveAvailableHours) * 100, rounded to 1 decimal.
 * Returns 0 if no effective hours available.
 */
function computeAverageUtilization(data: AggregatedResourceData[]): number {
  if (data.length === 0) return 0;

  const totalHours = data.reduce((sum, r) => sum + r.totalHours, 0);
  const totalEffective = data.reduce((sum, r) => sum + r.effectiveAvailableHours, 0);

  if (totalEffective === 0) return 0;

  return Math.round((totalHours / totalEffective) * 1000) / 10;
}

/**
 * Counts resources classified as over-utilized.
 */
function computeOverUtilizedCount(data: AggregatedResourceData[]): number {
  return data.filter(r => r.utilizationCategory === 'over-utilized').length;
}

/**
 * Counts resources classified as under-utilized.
 */
function computeUnderUtilizedCount(data: AggregatedResourceData[]): number {
  return data.filter(r => r.utilizationCategory === 'under-utilized').length;
}

/**
 * Calculates total available capacity hours.
 * Formula: sum(effectiveAvailableHours - totalHours) for all resources.
 */
function computeTotalAvailableCapacity(data: AggregatedResourceData[]): number {
  return data.reduce((sum, r) => sum + (r.effectiveAvailableHours - r.totalHours), 0);
}

/**
 * Finds the resource with the highest total hours.
 * Ties are broken alphabetically (case-insensitive, first alphabetically wins).
 * Returns empty string if no data.
 */
function computeHighestUtilizedResource(data: AggregatedResourceData[]): string {
  if (data.length === 0) return '';

  let highest = data[0];

  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    if (
      current.totalHours > highest.totalHours ||
      (current.totalHours === highest.totalHours &&
        current.resourceName.toLowerCase() < highest.resourceName.toLowerCase())
    ) {
      highest = current;
    }
  }

  return highest.resourceName;
}

/**
 * Determines trend direction for a numeric metric.
 *
 * @param current - Current metric value
 * @param previous - Previous month metric value
 * @param higherIsBetter - If true, higher current = 'up' (improved); if false, lower current = 'up'
 * @returns Trend direction
 */
function computeNumericTrend(
  current: number,
  previous: number,
  higherIsBetter: boolean
): 'up' | 'down' | 'neutral' {
  if (current === previous) return 'neutral';

  if (higherIsBetter) {
    return current > previous ? 'up' : 'down';
  } else {
    return current < previous ? 'up' : 'down';
  }
}

/**
 * Calculates all dashboard metrics with trend indicators.
 *
 * @param currentData - Aggregated resource data for the current period
 * @param previousMonthData - Optional aggregated resource data for the previous month (for trend comparison)
 * @returns MetricsResult with each metric value and its trend indicator
 */
export function calculateMetrics(
  currentData: AggregatedResourceData[],
  previousMonthData?: AggregatedResourceData[]
): MetricsResult {
  // Compute current metrics
  const avgUtilization = computeAverageUtilization(currentData);
  const overCount = computeOverUtilizedCount(currentData);
  const underCount = computeUnderUtilizedCount(currentData);
  const availableCapacity = computeTotalAvailableCapacity(currentData);
  const highestResource = computeHighestUtilizedResource(currentData);

  // If no previous data, all trends are null
  if (!previousMonthData || previousMonthData.length === 0) {
    return {
      averageUtilizationPercentage: { value: avgUtilization, trend: null },
      overUtilizedCount: { value: overCount, trend: null },
      underUtilizedCount: { value: underCount, trend: null },
      totalAvailableCapacityHours: { value: availableCapacity, trend: null },
      highestUtilizedResource: { value: highestResource, trend: null },
    };
  }

  // Compute previous metrics for trend comparison
  const prevAvgUtilization = computeAverageUtilization(previousMonthData);
  const prevOverCount = computeOverUtilizedCount(previousMonthData);
  const prevUnderCount = computeUnderUtilizedCount(previousMonthData);
  const prevAvailableCapacity = computeTotalAvailableCapacity(previousMonthData);

  return {
    averageUtilizationPercentage: {
      value: avgUtilization,
      // Higher utilization is "up" (improved)
      trend: computeNumericTrend(avgUtilization, prevAvgUtilization, true),
    },
    overUtilizedCount: {
      value: overCount,
      // Lower over-utilized count is "up" (improved — fewer over-utilized is better)
      trend: computeNumericTrend(overCount, prevOverCount, false),
    },
    underUtilizedCount: {
      value: underCount,
      // Lower under-utilized count is "up" (improved — fewer under-utilized is better)
      trend: computeNumericTrend(underCount, prevUnderCount, false),
    },
    totalAvailableCapacityHours: {
      value: availableCapacity,
      // Higher available capacity is "up" (more capacity available)
      trend: computeNumericTrend(availableCapacity, prevAvailableCapacity, true),
    },
    highestUtilizedResource: {
      value: highestResource,
      // Name comparison doesn't have a direction — always null
      trend: null,
    },
  };
}
