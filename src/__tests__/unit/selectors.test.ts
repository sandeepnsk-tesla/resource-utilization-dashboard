/**
 * Unit tests for src/state/selectors.ts
 *
 * Validates that selectors correctly derive state: aggregation, filtering, metrics, and filter options.
 */

import { describe, it, expect } from 'vitest';
import type { AppState } from '../../types/state';
import type { TimesheetData, WorkbookMetadata } from '../../types/index';
import {
  selectAggregatedResources,
  selectFilteredResources,
  selectAggregatedProjects,
  selectAggregatedMonths,
  selectMetrics,
  selectAvailableFilterOptions,
} from '../../state/selectors';

function createTestState(overrides?: Partial<AppState>): AppState {
  const timesheets: TimesheetData[] = [
    {
      workbookId: 'wb-1',
      resourceName: 'Alice',
      entries: [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 80, projectName: 'ProjectAlpha', sourceDocLink: '' },
        { date: '2026-07-02', taskDescription: 'Task B', hoursWorked: 60, projectName: 'ProjectBeta', sourceDocLink: '' },
      ],
    },
    {
      workbookId: 'wb-2',
      resourceName: 'Bob',
      entries: [
        { date: '2026-07-01', taskDescription: 'Task C', hoursWorked: 180, projectName: 'ProjectAlpha', sourceDocLink: '' },
      ],
    },
    {
      workbookId: 'wb-3',
      resourceName: 'Charlie',
      entries: [
        { date: '2026-07-01', taskDescription: 'Task D', hoursWorked: 50, projectName: 'ProjectGamma', sourceDocLink: '' },
      ],
    },
  ];

  const workbooks: WorkbookMetadata[] = [
    { id: 'wb-1', projectName: 'ProjectAlpha', month: 'July', year: 2026, fileName: 'ProjectAlpha_July_2026.xlsx', origin: 'local', fileSize: 1000, importedAt: '2026-07-01T00:00:00Z', resourceCount: 1 },
    { id: 'wb-2', projectName: 'ProjectAlpha', month: 'July', year: 2026, fileName: 'ProjectAlpha_July_2026_2.xlsx', origin: 'local', fileSize: 1000, importedAt: '2026-07-01T00:00:00Z', resourceCount: 1 },
    { id: 'wb-3', projectName: 'ProjectGamma', month: 'July', year: 2026, fileName: 'ProjectGamma_July_2026.xlsx', origin: 'local', fileSize: 1000, importedAt: '2026-07-01T00:00:00Z', resourceCount: 1 },
  ];

  return {
    workbooks,
    timesheets,
    config: {
      thresholds: { minOptimalHours: 140, maxOptimalHours: 176 },
      workingDaysPerMonth: 22,
      dailyHourExpectation: 8,
      resourceBufferDays: {},
    },
    filters: { projects: [], resources: [], months: [], categories: [] },
    activeView: 'overview',
    aiInsights: [],
    aiStatus: 'idle',
    ...overrides,
  };
}

describe('selectAggregatedResources', () => {
  it('should aggregate timesheets by resource', () => {
    const state = createTestState();
    const result = selectAggregatedResources(state);

    expect(result).toHaveLength(3);

    const alice = result.find(r => r.resourceName === 'Alice');
    expect(alice).toBeDefined();
    expect(alice!.totalHours).toBe(140); // 80 + 60
    expect(alice!.month).toBe('July');
    expect(alice!.year).toBe(2026);

    const bob = result.find(r => r.resourceName === 'Bob');
    expect(bob).toBeDefined();
    expect(bob!.totalHours).toBe(180);
    expect(bob!.utilizationCategory).toBe('over-utilized');

    const charlie = result.find(r => r.resourceName === 'Charlie');
    expect(charlie).toBeDefined();
    expect(charlie!.totalHours).toBe(50);
    expect(charlie!.utilizationCategory).toBe('under-utilized');
  });

  it('should use buffer config from state for classification', () => {
    const state = createTestState({
      config: {
        thresholds: { minOptimalHours: 140, maxOptimalHours: 176 },
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        resourceBufferDays: { alice: { July: 5 } },
      },
    });
    const result = selectAggregatedResources(state);

    const alice = result.find(r => r.resourceName === 'Alice');
    expect(alice).toBeDefined();
    // With 5 buffer days: effectiveAvailable = (22-5)*8 = 136
    // Alice has 140 hours which is >= minOptimal so optimally-utilized
    expect(alice!.utilizationCategory).toBe('optimally-utilized');
  });
});

describe('selectFilteredResources', () => {
  it('should return all resources when filters are empty', () => {
    const state = createTestState();
    const result = selectFilteredResources(state);
    expect(result).toHaveLength(3);
  });

  it('should filter by resource name', () => {
    const state = createTestState({
      filters: { projects: [], resources: ['Alice'], months: [], categories: [] },
    });
    const result = selectFilteredResources(state);
    expect(result).toHaveLength(1);
    expect(result[0].resourceName).toBe('Alice');
  });

  it('should filter by project name', () => {
    const state = createTestState({
      filters: { projects: ['ProjectGamma'], resources: [], months: [], categories: [] },
    });
    const result = selectFilteredResources(state);
    expect(result).toHaveLength(1);
    expect(result[0].resourceName).toBe('Charlie');
  });

  it('should filter by utilization category', () => {
    const state = createTestState({
      filters: { projects: [], resources: [], months: [], categories: ['over-utilized'] },
    });
    const result = selectFilteredResources(state);
    expect(result).toHaveLength(1);
    expect(result[0].resourceName).toBe('Bob');
  });
});

describe('selectAggregatedProjects', () => {
  it('should aggregate timesheets by project', () => {
    const state = createTestState();
    const result = selectAggregatedProjects(state);

    expect(result.length).toBeGreaterThanOrEqual(2);

    const alpha = result.find(p => p.projectName === 'ProjectAlpha');
    expect(alpha).toBeDefined();
    // Alice: 80 + Bob: 180 = 260 hours on ProjectAlpha in July
    expect(alpha!.totalHours).toBe(260);
    expect(alpha!.activeResourceCount).toBe(2);
  });
});

describe('selectAggregatedMonths', () => {
  it('should aggregate timesheets by month', () => {
    const state = createTestState();
    const result = selectAggregatedMonths(state);

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('July');
    expect(result[0].year).toBe(2026);
    // Total: Alice 140 + Bob 180 + Charlie 50 = 370
    expect(result[0].totalTeamHours).toBe(370);
  });
});

describe('selectMetrics', () => {
  it('should calculate metrics from filtered data', () => {
    const state = createTestState();
    const result = selectMetrics(state);

    // overUtilizedCount: Bob (180 > 176)
    expect(result.overUtilizedCount.value).toBe(1);
    // underUtilizedCount: Charlie (50 < 140)
    expect(result.underUtilizedCount.value).toBe(1);
    // highestUtilizedResource: Bob (180 hours)
    expect(result.highestUtilizedResource.value).toBe('Bob');
  });

  it('should return empty metrics for empty state', () => {
    const state = createTestState({ timesheets: [] });
    const result = selectMetrics(state);
    expect(result.averageUtilizationPercentage.value).toBe(0);
    expect(result.overUtilizedCount.value).toBe(0);
    expect(result.underUtilizedCount.value).toBe(0);
  });
});

describe('selectAvailableFilterOptions', () => {
  it('should extract unique project names sorted alphabetically', () => {
    const state = createTestState();
    const result = selectAvailableFilterOptions(state);
    expect(result.projects).toEqual(['ProjectAlpha', 'ProjectBeta', 'ProjectGamma']);
  });

  it('should extract unique resource names sorted alphabetically', () => {
    const state = createTestState();
    const result = selectAvailableFilterOptions(state);
    expect(result.resources).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('should extract unique month-year combinations sorted', () => {
    const state = createTestState();
    const result = selectAvailableFilterOptions(state);
    expect(result.months).toEqual(['July 2026']);
  });

  it('should return empty arrays for empty state', () => {
    const state = createTestState({ timesheets: [] });
    const result = selectAvailableFilterOptions(state);
    expect(result.projects).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.months).toEqual([]);
  });
});
