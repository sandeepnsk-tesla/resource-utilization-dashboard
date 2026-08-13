/**
 * Derived State Selectors
 *
 * Pure functions that compute derived state from raw AppState,
 * plus React hooks that read from AppContext and memoize results with useMemo.
 *
 * Requirements: 11.2, 12.1
 */

import { useMemo } from 'react';
import type { AppState } from '../types/state';
import type {
  AggregatedResourceData,
  AggregatedProjectData,
  AggregatedMonthData,
} from '../types/index';
import type { MetricsResult } from '../logic/metricsCalculator';
import type { BufferConfig } from '../types/config';
import { aggregateByResource, aggregateByProject, aggregateByMonth } from '../logic/aggregationEngine';
import { applyFilters } from '../logic/filterEngine';
import { calculateMetrics } from '../logic/metricsCalculator';
import { useAppContext } from './AppContext';

// ---------------------------------------------------------------------------
// Simple memoization utility for single-argument selectors keyed by reference
// ---------------------------------------------------------------------------

interface MemoCache<T> {
  state: AppState | null;
  result: T | null;
}

function createMemoizedSelector<T>(
  compute: (state: AppState) => T
): (state: AppState) => T {
  const cache: MemoCache<T> = { state: null, result: null };

  return (state: AppState): T => {
    if (cache.state === state) {
      return cache.result as T;
    }
    const result = compute(state);
    cache.state = state;
    cache.result = result;
    return result;
  };
}

// ---------------------------------------------------------------------------
// Helper: Build buffer configs map from AppState
// ---------------------------------------------------------------------------

function buildBufferConfigs(state: AppState): Map<string, BufferConfig> {
  const bufferConfigs = new Map<string, BufferConfig>();
  const { workingDaysPerMonth, dailyHourExpectation, resourceBufferDays } = state.config;

  for (const resourceName of Object.keys(resourceBufferDays)) {
    const monthBuffers = resourceBufferDays[resourceName];
    for (const month of Object.keys(monthBuffers)) {
      const bufferDays = monthBuffers[month];
      // Key format matches what aggregationEngine uses: lowercase resource name
      bufferConfigs.set(resourceName.toLowerCase(), {
        workingDaysPerMonth,
        dailyHourExpectation,
        bufferDays,
      });
    }
  }

  return bufferConfigs;
}

// ---------------------------------------------------------------------------
// Helper: Enrich timesheets with project names from workbook metadata
// When entry.projectName is empty, inherit from the workbook's projectName
// ---------------------------------------------------------------------------

function enrichTimesheetsWithProjectNames(state: AppState): typeof state.timesheets {
  // Build a map of workbookId → projectName from metadata
  const workbookProjectMap = new Map<string, string>();
  for (const wb of state.workbooks) {
    if (wb.projectName && wb.projectName !== 'Unknown Project') {
      workbookProjectMap.set(wb.id, wb.projectName);
    }
  }

  // If no workbooks have project names, return as-is
  if (workbookProjectMap.size === 0) return state.timesheets;

  return state.timesheets.map((ts) => {
    const wbProjectName = workbookProjectMap.get(ts.workbookId);
    if (!wbProjectName) return ts;

    // Check if any entries have empty project names
    const hasEmptyProjects = ts.entries.some((e) => !e.projectName || !e.projectName.trim());
    if (!hasEmptyProjects) return ts;

    // Fill in empty project names with workbook's project name
    return {
      ...ts,
      entries: ts.entries.map((e) => ({
        ...e,
        projectName: (e.projectName && e.projectName.trim()) ? e.projectName : wbProjectName,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Selector: Aggregated resource data from raw timesheets + config
// ---------------------------------------------------------------------------

function computeAggregatedResources(state: AppState): AggregatedResourceData[] {
  if (state.timesheets.length === 0) return [];

  const bufferConfigs = buildBufferConfigs(state);
  return aggregateByResource(enrichTimesheetsWithProjectNames(state), state.config.thresholds, bufferConfigs);
}

/**
 * Get aggregated resource data from raw timesheets and configuration.
 * Memoized: recomputes only when the state reference changes.
 */
export const selectAggregatedResources = createMemoizedSelector(computeAggregatedResources);

// ---------------------------------------------------------------------------
// Selector: Apply current filters to aggregated data
// ---------------------------------------------------------------------------

function computeFilteredResources(state: AppState): AggregatedResourceData[] {
  const aggregated = selectAggregatedResources(state);
  return applyFilters(aggregated, state.filters);
}

/**
 * Get filtered aggregated resource data based on the current filter state.
 * Applies AND/OR filter logic per requirements 11.2, 11.3.
 */
export const selectFilteredResources = createMemoizedSelector(computeFilteredResources);

// ---------------------------------------------------------------------------
// Selector: Aggregated project data
// ---------------------------------------------------------------------------

function computeAggregatedProjects(state: AppState): AggregatedProjectData[] {
  if (state.timesheets.length === 0) return [];
  return aggregateByProject(enrichTimesheetsWithProjectNames(state), state.workbooks);
}

/**
 * Get aggregated project data from raw timesheets and workbook metadata.
 */
export const selectAggregatedProjects = createMemoizedSelector(computeAggregatedProjects);

// ---------------------------------------------------------------------------
// Selector: Aggregated monthly data
// ---------------------------------------------------------------------------

function computeAggregatedMonths(state: AppState): AggregatedMonthData[] {
  if (state.timesheets.length === 0) return [];

  const bufferConfigs = buildBufferConfigs(state);
  return aggregateByMonth(enrichTimesheetsWithProjectNames(state), state.workbooks, state.config.thresholds, bufferConfigs);
}

/**
 * Get aggregated monthly data combining all resources per month.
 */
export const selectAggregatedMonths = createMemoizedSelector(computeAggregatedMonths);

// ---------------------------------------------------------------------------
// Selector: Dashboard metrics with optional previous month comparison
// ---------------------------------------------------------------------------

function computeMetrics(state: AppState): MetricsResult {
  const filteredResources = selectFilteredResources(state);

  if (filteredResources.length === 0) {
    return calculateMetrics([]);
  }

  // Find the current (most recent) month in the filtered data
  const allAggregated = selectAggregatedResources(state);

  // Determine unique months, sorted by year and month
  const monthOrder = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const uniqueMonths = Array.from(
    new Set(allAggregated.map((r) => `${r.month}_${r.year}`))
  ).sort((a, b) => {
    const [monthA, yearA] = a.split('_');
    const [monthB, yearB] = b.split('_');
    const yearDiff = parseInt(yearA) - parseInt(yearB);
    if (yearDiff !== 0) return yearDiff;
    return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
  });

  // If we have at least 2 months, use the second-to-last as "previous"
  if (uniqueMonths.length >= 2) {
    const previousMonthKey = uniqueMonths[uniqueMonths.length - 2];
    const [prevMonth, prevYear] = previousMonthKey.split('_');

    const previousMonthData = allAggregated.filter(
      (r) => r.month === prevMonth && r.year === parseInt(prevYear)
    );

    return calculateMetrics(filteredResources, previousMonthData);
  }

  return calculateMetrics(filteredResources);
}

/**
 * Calculate dashboard metrics (with optional previous month comparison).
 * Validates: Requirements 12.1
 */
export const selectMetrics = createMemoizedSelector(computeMetrics);

// ---------------------------------------------------------------------------
// Selector: Available project names from imported data
// ---------------------------------------------------------------------------

function computeAvailableProjects(state: AppState): string[] {
  const projectNames = new Set<string>();

  for (const timesheet of state.timesheets) {
    for (const entry of timesheet.entries) {
      if (entry.projectName && entry.projectName.trim()) {
        projectNames.add(entry.projectName.trim());
      }
    }
  }

  // Also include project names from workbook metadata
  for (const wb of state.workbooks) {
    if (wb.projectName && wb.projectName.trim() && wb.projectName !== 'Unknown Project') {
      projectNames.add(wb.projectName.trim());
    }
  }

  return Array.from(projectNames).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Get unique project names from all imported data, sorted alphabetically.
 */
export const selectAvailableProjects = createMemoizedSelector(computeAvailableProjects);

// ---------------------------------------------------------------------------
// Selector: Available resource names from imported data
// ---------------------------------------------------------------------------

function computeAvailableResources(state: AppState): string[] {
  const resourceNames = new Set<string>();

  for (const timesheet of state.timesheets) {
    // Use trimmed resource name, deduplicate case-insensitively
    const name = timesheet.resourceName.trim();
    resourceNames.add(name);
  }

  // Deduplicate case-insensitively: keep first occurrence
  const seen = new Map<string, string>();
  for (const name of resourceNames) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, name);
    }
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
}

/**
 * Get unique resource names from imported data, sorted alphabetically.
 * Case-insensitive deduplication.
 */
export const selectAvailableResources = createMemoizedSelector(computeAvailableResources);

// ---------------------------------------------------------------------------
// Selector: Available months from imported data (format: "Month Year")
// ---------------------------------------------------------------------------

function computeAvailableMonths(state: AppState): string[] {
  const monthOrder = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const monthYears = new Set<string>();

  for (const timesheet of state.timesheets) {
    for (const entry of timesheet.entries) {
      const date = new Date(entry.date);
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      monthYears.add(`${month} ${year}`);
    }
  }

  return Array.from(monthYears).sort((a, b) => {
    const [monthA, yearA] = a.split(' ');
    const [monthB, yearB] = b.split(' ');
    const yearDiff = parseInt(yearA) - parseInt(yearB);
    if (yearDiff !== 0) return yearDiff;
    return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
  });
}

/**
 * Get unique months from imported data in "Month Year" format, sorted chronologically.
 */
export const selectAvailableMonths = createMemoizedSelector(computeAvailableMonths);

// ---------------------------------------------------------------------------
// Convenience: selectAvailableFilterOptions (combines project, resource, month)
// ---------------------------------------------------------------------------

export function selectAvailableFilterOptions(state: AppState): {
  projects: string[];
  resources: string[];
  months: string[];
} {
  return {
    projects: selectAvailableProjects(state),
    resources: selectAvailableResources(state),
    months: selectAvailableMonths(state),
  };
}

// ===========================================================================
// React Hooks — read from AppContext and memoize with useMemo
// ===========================================================================

/**
 * Helper to read the app state from context. Used internally by all hooks below.
 */
function useAppState(): AppState {
  const { state } = useAppContext();
  return state;
}

/**
 * Returns aggregated resource data for the current state.
 * Memoized: recomputes only when timesheets, thresholds, or buffer config change.
 */
export function useAggregatedResourceData(): AggregatedResourceData[] {
  const state = useAppState();

  return useMemo(() => {
    if (state.timesheets.length === 0) return [];
    const bufferConfigs = buildBufferConfigs(state);
    return aggregateByResource(enrichTimesheetsWithProjectNames(state), state.config.thresholds, bufferConfigs);
  }, [state.timesheets, state.config.thresholds, state.config.resourceBufferDays, state.config.workingDaysPerMonth, state.config.dailyHourExpectation]);
}

/**
 * Returns filtered aggregated resource data.
 * Applies the current filter state to the aggregated resource data.
 */
export function useFilteredResourceData(): AggregatedResourceData[] {
  const state = useAppState();

  const aggregated = useMemo(() => {
    if (state.timesheets.length === 0) return [];
    const bufferConfigs = buildBufferConfigs(state);
    return aggregateByResource(enrichTimesheetsWithProjectNames(state), state.config.thresholds, bufferConfigs);
  }, [state.timesheets, state.config.thresholds, state.config.resourceBufferDays, state.config.workingDaysPerMonth, state.config.dailyHourExpectation]);

  return useMemo(
    () => applyFilters(aggregated, state.filters),
    [aggregated, state.filters]
  );
}

/**
 * Returns aggregated project data.
 */
export function useAggregatedProjectData(): AggregatedProjectData[] {
  const state = useAppState();

  return useMemo(() => {
    if (state.timesheets.length === 0) return [];
    return aggregateByProject(enrichTimesheetsWithProjectNames(state), state.workbooks);
  }, [state.timesheets, state.workbooks]);
}

/**
 * Returns aggregated month data.
 */
export function useAggregatedMonthData(): AggregatedMonthData[] {
  const state = useAppState();

  return useMemo(() => {
    if (state.timesheets.length === 0) return [];
    const bufferConfigs = buildBufferConfigs(state);
    return aggregateByMonth(enrichTimesheetsWithProjectNames(state), state.workbooks, state.config.thresholds, bufferConfigs);
  }, [state.timesheets, state.workbooks, state.config.thresholds, state.config.resourceBufferDays, state.config.workingDaysPerMonth, state.config.dailyHourExpectation]);
}

/**
 * Returns current dashboard metrics.
 * Computes metrics from filtered data with optional previous-month trend comparison.
 */
export function useDashboardMetrics(): MetricsResult {
  const state = useAppState();

  const aggregated = useMemo(() => {
    if (state.timesheets.length === 0) return [];
    const bufferConfigs = buildBufferConfigs(state);
    return aggregateByResource(enrichTimesheetsWithProjectNames(state), state.config.thresholds, bufferConfigs);
  }, [state.timesheets, state.config.thresholds, state.config.resourceBufferDays, state.config.workingDaysPerMonth, state.config.dailyHourExpectation]);

  const filtered = useMemo(
    () => applyFilters(aggregated, state.filters),
    [aggregated, state.filters]
  );

  return useMemo(() => {
    if (filtered.length === 0) {
      return calculateMetrics([]);
    }

    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const uniqueMonths = Array.from(
      new Set(aggregated.map((r) => `${r.month}_${r.year}`))
    ).sort((a, b) => {
      const [monthA, yearA] = a.split('_');
      const [monthB, yearB] = b.split('_');
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
    });

    if (uniqueMonths.length >= 2) {
      const previousMonthKey = uniqueMonths[uniqueMonths.length - 2];
      const [prevMonth, prevYear] = previousMonthKey.split('_');

      const previousMonthData = aggregated.filter(
        (r) => r.month === prevMonth && r.year === parseInt(prevYear)
      );

      return calculateMetrics(filtered, previousMonthData);
    }

    return calculateMetrics(filtered);
  }, [filtered, aggregated]);
}

/**
 * Returns all unique project names from imported data.
 */
export function useAvailableProjects(): string[] {
  const state = useAppState();

  return useMemo(() => {
    const projectNames = new Set<string>();
    for (const timesheet of state.timesheets) {
      for (const entry of timesheet.entries) {
        if (entry.projectName && entry.projectName.trim()) {
          projectNames.add(entry.projectName.trim());
        }
      }
    }
    // Also include project names from workbook metadata
    for (const wb of state.workbooks) {
      if (wb.projectName && wb.projectName.trim() && wb.projectName !== 'Unknown Project') {
        projectNames.add(wb.projectName.trim());
      }
    }
    return Array.from(projectNames).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [state.timesheets, state.workbooks]);
}

/**
 * Returns all unique resource names from imported data.
 */
export function useAvailableResources(): string[] {
  const state = useAppState();

  return useMemo(() => {
    const resourceNames = new Set<string>();
    for (const timesheet of state.timesheets) {
      const name = timesheet.resourceName.trim();
      resourceNames.add(name);
    }

    const seen = new Map<string, string>();
    for (const name of resourceNames) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, name);
      }
    }

    return Array.from(seen.values()).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [state.timesheets]);
}

/**
 * Returns all available months (format "Month Year") from imported data.
 */
export function useAvailableMonths(): string[] {
  const state = useAppState();

  return useMemo(() => {
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const monthYears = new Set<string>();
    for (const timesheet of state.timesheets) {
      for (const entry of timesheet.entries) {
        const date = new Date(entry.date);
        const month = date.toLocaleString('en-US', { month: 'long' });
        const year = date.getFullYear();
        monthYears.add(`${month} ${year}`);
      }
    }

    return Array.from(monthYears).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
    });
  }, [state.timesheets]);
}
