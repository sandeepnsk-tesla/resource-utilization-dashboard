/**
 * Aggregation Engine Module
 *
 * Aggregates raw timesheet data across resources, projects, and months.
 * Handles cross-project resource aggregation with case-insensitive name matching.
 *
 * Requirements: 4.2, 8.3, 10.2
 */

import type { TimesheetData, WorkbookMetadata, AggregatedResourceData, AggregatedProjectData, AggregatedMonthData, ProjectHours } from '../types/index';
import type { ThresholdConfig, BufferConfig, UtilizationCategory } from '../types/config';
import { classifyResource, calculateEffectiveAvailableHours } from './utilizationClassifier';

/**
 * Aggregates timesheet data by resource.
 *
 * Groups all timesheet entries by resource name (case-insensitive matching),
 * then by month+year. For each resource-month combination:
 * - Sums total hours across all workbooks
 * - Computes project breakdown (hours per project)
 * - Counts distinct tasks
 * - Uses utilization classifier to determine category
 *
 * @param timesheets - Array of timesheet data from all imported workbooks
 * @param thresholds - Threshold configuration for utilization classification
 * @param bufferConfigs - Map of resource name (lowercase) to BufferConfig
 * @returns Array of aggregated resource data
 */
export function aggregateByResource(
  timesheets: TimesheetData[],
  thresholds: ThresholdConfig,
  bufferConfigs: Map<string, BufferConfig>
): AggregatedResourceData[] {
  // Default buffer config when none is specified for a resource
  const defaultBufferConfig: BufferConfig = {
    workingDaysPerMonth: 22,
    dailyHourExpectation: 8,
    bufferDays: 0,
  };

  // Group entries by resource name (case-insensitive) then by month+year
  const resourceMap = new Map<string, Map<string, {
    entries: { projectName: string; hours: number; taskDescription: string }[];
    originalName: string;
  }>>();

  for (const timesheet of timesheets) {
    const resourceKey = timesheet.resourceName.trim().toLowerCase();
    const originalName = timesheet.resourceName.trim();

    if (!resourceMap.has(resourceKey)) {
      resourceMap.set(resourceKey, new Map());
    }
    const monthMap = resourceMap.get(resourceKey)!;

    for (const entry of timesheet.entries) {
      // Extract month and year from the entry date (ISO 8601 format: "2026-07-15")
      const date = new Date(entry.date);
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      const monthYearKey = `${month}_${year}`;

      if (!monthMap.has(monthYearKey)) {
        monthMap.set(monthYearKey, { entries: [], originalName });
      }
      const monthData = monthMap.get(monthYearKey)!;
      // Keep the most recent original name encountered
      monthData.originalName = originalName;
      monthData.entries.push({
        projectName: entry.projectName,
        hours: entry.hoursWorked,
        taskDescription: entry.taskDescription,
      });
    }
  }

  // Build aggregated results
  const results: AggregatedResourceData[] = [];

  for (const [resourceKey, monthMap] of resourceMap) {
    for (const [monthYearKey, data] of monthMap) {
      const [month, yearStr] = monthYearKey.split('_');
      const year = parseInt(yearStr, 10);

      // Sum total hours
      const totalHours = data.entries.reduce((sum, e) => sum + e.hours, 0);

      // Compute project breakdown
      const projectHoursMap = new Map<string, number>();
      for (const entry of data.entries) {
        const existing = projectHoursMap.get(entry.projectName) || 0;
        projectHoursMap.set(entry.projectName, existing + entry.hours);
      }
      const projects: ProjectHours[] = Array.from(projectHoursMap.entries()).map(
        ([projectName, hours]) => ({ projectName, hours })
      );

      // Count distinct tasks
      const distinctTasks = new Set(data.entries.map(e => e.taskDescription));
      const taskCount = distinctTasks.size;

      // Get buffer config for this resource (case-insensitive lookup)
      const bufferConfig = bufferConfigs.get(resourceKey) || defaultBufferConfig;

      // Classify utilization
      const classification = classifyResource(totalHours, thresholds, bufferConfig);

      results.push({
        resourceName: data.originalName,
        month,
        year,
        totalHours,
        projects,
        taskCount,
        effectiveAvailableHours: classification.effectiveAvailableHours,
        utilizationCategory: classification.category,
        utilizationPercentage: classification.utilizationPercentage,
      });
    }
  }

  return results;
}

/**
 * Aggregates timesheet data by project.
 *
 * Groups entries by project name and month+year, computing:
 * - Total hours per project per month
 * - Active resource count (resources with hours > 0)
 * - Per-resource breakdown with utilization category
 * - Average utilization percentage
 *
 * @param timesheets - Array of timesheet data from all imported workbooks
 * @param workbooks - Metadata for all imported workbooks (used for project-month mapping)
 * @returns Array of aggregated project data
 */
export function aggregateByProject(
  timesheets: TimesheetData[],
  workbooks: WorkbookMetadata[]
): AggregatedProjectData[] {
  // Build a workbookId -> metadata map for project/month lookup
  const workbookMap = new Map<string, WorkbookMetadata>();
  for (const wb of workbooks) {
    workbookMap.set(wb.id, wb);
  }

  // Group by project name + month + year
  const projectMap = new Map<string, {
    projectName: string;
    month: string;
    year: number;
    resources: Map<string, { hours: number; resourceName: string }>;
  }>();

  for (const timesheet of timesheets) {
    for (const entry of timesheet.entries) {
      const date = new Date(entry.date);
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      const projectKey = `${entry.projectName.toLowerCase()}_${month}_${year}`;

      if (!projectMap.has(projectKey)) {
        projectMap.set(projectKey, {
          projectName: entry.projectName,
          month,
          year,
          resources: new Map(),
        });
      }

      const projectData = projectMap.get(projectKey)!;
      const resourceKey = timesheet.resourceName.trim().toLowerCase();

      if (!projectData.resources.has(resourceKey)) {
        projectData.resources.set(resourceKey, {
          hours: 0,
          resourceName: timesheet.resourceName.trim(),
        });
      }

      const resourceData = projectData.resources.get(resourceKey)!;
      resourceData.hours += entry.hoursWorked;
    }
  }

  // Build results
  const results: AggregatedProjectData[] = [];

  for (const [, data] of projectMap) {
    const resources: { resourceName: string; hours: number; category: UtilizationCategory }[] = [];
    let totalHours = 0;
    let totalEffectiveHours = 0;
    let activeResourceCount = 0;

    for (const [, resourceData] of data.resources) {
      if (resourceData.hours > 0) {
        activeResourceCount++;
      }
      totalHours += resourceData.hours;

      // Use default buffer config for project-level aggregation
      const defaultBuffer: BufferConfig = {
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        bufferDays: 0,
      };
      const effectiveHours = calculateEffectiveAvailableHours(defaultBuffer);
      totalEffectiveHours += effectiveHours;

      // Classify each resource using default thresholds for project view
      const defaultThresholds: ThresholdConfig = {
        minOptimalHours: 140,
        maxOptimalHours: 176,
      };
      const classification = classifyResource(resourceData.hours, defaultThresholds, defaultBuffer);

      resources.push({
        resourceName: resourceData.resourceName,
        hours: resourceData.hours,
        category: classification.category,
      });
    }

    const averageUtilizationPercentage = totalEffectiveHours > 0
      ? (totalHours / totalEffectiveHours) * 100
      : 0;

    results.push({
      projectName: data.projectName,
      month: data.month,
      year: data.year,
      totalHours,
      activeResourceCount,
      resources,
      averageUtilizationPercentage,
    });
  }

  return results;
}

/**
 * Aggregates timesheet data by month.
 *
 * Groups entries by month+year, computing:
 * - Total team hours (sum of all resource hours)
 * - Total available capacity (sum of effective available hours)
 * - Overall utilization percentage
 * - Category counts (how many resources in each category)
 * - Per-resource breakdowns
 *
 * @param timesheets - Array of timesheet data from all imported workbooks
 * @param workbooks - Metadata for all imported workbooks
 * @param thresholds - Threshold configuration for utilization classification
 * @param bufferConfigs - Map of resource name (lowercase) to BufferConfig
 * @returns Array of aggregated monthly data
 */
export function aggregateByMonth(
  timesheets: TimesheetData[],
  _workbooks: WorkbookMetadata[],
  thresholds: ThresholdConfig,
  bufferConfigs: Map<string, BufferConfig>
): AggregatedMonthData[] {
  // First, aggregate by resource to get per-resource-month data
  const resourceData = aggregateByResource(timesheets, thresholds, bufferConfigs);

  // Group resource data by month+year
  const monthMap = new Map<string, AggregatedResourceData[]>();

  for (const rd of resourceData) {
    const monthKey = `${rd.month}_${rd.year}`;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(rd);
  }

  // Build results
  const results: AggregatedMonthData[] = [];

  for (const [monthKey, resources] of monthMap) {
    const [month, yearStr] = monthKey.split('_');
    const year = parseInt(yearStr, 10);

    const totalTeamHours = resources.reduce((sum, r) => sum + r.totalHours, 0);
    const totalAvailableCapacity = resources.reduce((sum, r) => sum + r.effectiveAvailableHours, 0);
    const overallUtilizationPercentage = totalAvailableCapacity > 0
      ? (totalTeamHours / totalAvailableCapacity) * 100
      : 0;

    const categoryCounts: Record<UtilizationCategory, number> = {
      'over-utilized': 0,
      'under-utilized': 0,
      'optimally-utilized': 0,
    };

    for (const r of resources) {
      categoryCounts[r.utilizationCategory]++;
    }

    results.push({
      month,
      year,
      totalTeamHours,
      totalAvailableCapacity,
      overallUtilizationPercentage,
      categoryCounts,
      resources,
    });
  }

  return results;
}
