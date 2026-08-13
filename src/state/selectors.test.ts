/**
 * Unit tests for derived state selectors.
 *
 * Tests that selectors correctly derive computed state from raw AppState,
 * including aggregation, filtering, metrics, and available filter options.
 */

import { describe, it, expect } from 'vitest';
import type { AppState } from '../types/state';
import type { TimesheetData, WorkbookMetadata } from '../types/index';
import type { AppConfig, FilterState } from '../types/config';
import {
  selectAggregatedResources,
  selectFilteredResources,
  selectAggregatedProjects,
  selectAggregatedMonths,
  selectMetrics,
  selectAvailableProjects,
  selectAvailableResources,
  selectAvailableMonths,
} from './selectors';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createDefaultConfig(): AppConfig {
  return {
    thresholds: { minOptimalHours: 140, maxOptimalHours: 176 },
    workingDaysPerMonth: 22,
    dailyHourExpectation: 8,
    resourceBufferDays: {},
  };
}

function createDefaultFilters(): FilterState {
  return {
    projects: [],
    resources: [],
    months: [],
    categories: [],
  };
}

function createEmptyState(): AppState {
  return {
    workbooks: [],
    timesheets: [],
    config: createDefaultConfig(),
    filters: createDefaultFilters(),
    activeView: 'overview',
    aiInsights: [],
    aiStatus: 'idle',
  };
}

function createWorkbook(id: string, projectName: string, month: string, year: number): WorkbookMetadata {
  return {
    id,
    projectName,
    month,
    year,
    fileName: `${projectName}_${month}_${year}.xlsx`,
    origin: 'local',
    fileSize: 1024,
    importedAt: new Date().toISOString(),
    resourceCount: 1,
  };
}

function createTimesheetEntry(date: string, hours: number, project: string, task: string = 'Task') {
  return {
    date,
    hoursWorked: hours,
    projectName: project,
    taskDescription: task,
    sourceDocLink: '',
  };
}

function createTimesheet(workbookId: string, resourceName: string, entries: ReturnType<typeof createTimesheetEntry>[]): TimesheetData {
  return { workbookId, resourceName, entries };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectAggregatedResources', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAggregatedResources(state);
    expect(result).toEqual([]);
  });

  it('aggregates resource data from timesheets', () => {
    const state = createEmptyState();
    state.workbooks = [createWorkbook('wb1', 'ProjectA', 'July', 2026)];
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA', 'Task 1'),
        createTimesheetEntry('2026-07-02', 7, 'ProjectA', 'Task 2'),
      ]),
    ];

    const result = selectAggregatedResources(state);
    expect(result.length).toBe(1);
    expect(result[0].resourceName).toBe('Alice');
    expect(result[0].totalHours).toBe(15);
    expect(result[0].month).toBe('July');
    expect(result[0].year).toBe(2026);
  });

  it('returns memoized result for same state reference', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
    ];

    const result1 = selectAggregatedResources(state);
    const result2 = selectAggregatedResources(state);
    expect(result1).toBe(result2); // Same reference = memoized
  });
});

describe('selectFilteredResources', () => {
  it('returns all resources when no filters are active', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 6, 'ProjectB'),
      ]),
    ];

    const result = selectFilteredResources(state);
    expect(result.length).toBe(2);
  });

  it('filters by resource name', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 6, 'ProjectB'),
      ]),
    ];
    state.filters = { ...createDefaultFilters(), resources: ['Alice'] };

    const result = selectFilteredResources(state);
    expect(result.length).toBe(1);
    expect(result[0].resourceName).toBe('Alice');
  });

  it('filters by project name', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 6, 'ProjectB'),
      ]),
    ];
    state.filters = { ...createDefaultFilters(), projects: ['ProjectA'] };

    const result = selectFilteredResources(state);
    expect(result.length).toBe(1);
    expect(result[0].resourceName).toBe('Alice');
  });

  it('filters by utilization category', () => {
    const state = createEmptyState();
    // Alice: 160 hours (optimal), Bob: 10 hours (under-utilized)
    state.timesheets = [
      createTimesheet('wb1', 'Alice', 
        Array.from({ length: 20 }, (_, i) =>
          createTimesheetEntry(`2026-07-${String(i + 1).padStart(2, '0')}`, 8, 'ProjectA')
        )
      ),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 10, 'ProjectB'),
      ]),
    ];
    state.filters = { ...createDefaultFilters(), categories: ['under-utilized'] };

    const result = selectFilteredResources(state);
    expect(result.length).toBe(1);
    expect(result[0].resourceName).toBe('Bob');
  });
});

describe('selectAggregatedProjects', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAggregatedProjects(state);
    expect(result).toEqual([]);
  });

  it('aggregates project data from timesheets', () => {
    const state = createEmptyState();
    state.workbooks = [createWorkbook('wb1', 'ProjectA', 'July', 2026)];
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb1', 'Bob', [
        createTimesheetEntry('2026-07-01', 6, 'ProjectA'),
      ]),
    ];

    const result = selectAggregatedProjects(state);
    expect(result.length).toBe(1);
    expect(result[0].projectName).toBe('ProjectA');
    expect(result[0].totalHours).toBe(14);
    expect(result[0].activeResourceCount).toBe(2);
  });
});

describe('selectAggregatedMonths', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAggregatedMonths(state);
    expect(result).toEqual([]);
  });

  it('aggregates monthly data', () => {
    const state = createEmptyState();
    state.workbooks = [createWorkbook('wb1', 'ProjectA', 'July', 2026)];
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb1', 'Bob', [
        createTimesheetEntry('2026-07-01', 6, 'ProjectA'),
      ]),
    ];

    const result = selectAggregatedMonths(state);
    expect(result.length).toBe(1);
    expect(result[0].month).toBe('July');
    expect(result[0].year).toBe(2026);
    expect(result[0].totalTeamHours).toBe(14);
    expect(result[0].resources.length).toBe(2);
  });
});

describe('selectMetrics', () => {
  it('returns zeroed metrics when no data exists', () => {
    const state = createEmptyState();
    const result = selectMetrics(state);
    expect(result.averageUtilizationPercentage.value).toBe(0);
    expect(result.overUtilizedCount.value).toBe(0);
    expect(result.underUtilizedCount.value).toBe(0);
    expect(result.totalAvailableCapacityHours.value).toBe(0);
    expect(result.highestUtilizedResource.value).toBe('');
  });

  it('calculates metrics from filtered data', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 150, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 100, 'ProjectB'),
      ]),
    ];

    const result = selectMetrics(state);
    expect(result.averageUtilizationPercentage.value).toBeGreaterThan(0);
    expect(result.highestUtilizedResource.value).toBe('Alice');
  });

  it('returns null trend when only one month of data exists', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 150, 'ProjectA'),
      ]),
    ];

    const result = selectMetrics(state);
    expect(result.averageUtilizationPercentage.trend).toBeNull();
  });
});

describe('selectAvailableProjects', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAvailableProjects(state);
    expect(result).toEqual([]);
  });

  it('returns unique sorted project names', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'Zeta'),
        createTimesheetEntry('2026-07-02', 8, 'Alpha'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2026-07-01', 8, 'Alpha'),
      ]),
    ];

    const result = selectAvailableProjects(state);
    expect(result).toEqual(['Alpha', 'Zeta']);
  });
});

describe('selectAvailableResources', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAvailableResources(state);
    expect(result).toEqual([]);
  });

  it('returns unique sorted resource names with case-insensitive dedup', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'alice', [
        createTimesheetEntry('2026-07-02', 8, 'ProjectB'),
      ]),
      createTimesheet('wb3', 'Bob', [
        createTimesheetEntry('2026-07-01', 8, 'ProjectA'),
      ]),
    ];

    const result = selectAvailableResources(state);
    expect(result.length).toBe(2);
    expect(result).toEqual(['Alice', 'Bob']);
  });
});

describe('selectAvailableMonths', () => {
  it('returns empty array when no timesheets exist', () => {
    const state = createEmptyState();
    const result = selectAvailableMonths(state);
    expect(result).toEqual([]);
  });

  it('returns unique months sorted chronologically', () => {
    const state = createEmptyState();
    state.timesheets = [
      createTimesheet('wb1', 'Alice', [
        createTimesheetEntry('2026-08-01', 8, 'ProjectA'),
        createTimesheetEntry('2026-07-15', 8, 'ProjectA'),
      ]),
      createTimesheet('wb2', 'Bob', [
        createTimesheetEntry('2025-12-01', 8, 'ProjectA'),
      ]),
    ];

    const result = selectAvailableMonths(state);
    expect(result).toEqual(['December 2025', 'July 2026', 'August 2026']);
  });
});
