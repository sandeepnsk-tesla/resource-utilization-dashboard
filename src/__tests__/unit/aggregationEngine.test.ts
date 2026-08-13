/**
 * Unit tests for the Aggregation Engine module.
 * Tests aggregation by resource, project, and month.
 */

import { describe, it, expect } from 'vitest';
import { aggregateByResource, aggregateByProject, aggregateByMonth } from '../../logic/aggregationEngine';
import type { TimesheetData, WorkbookMetadata } from '../../types/index';
import type { ThresholdConfig, BufferConfig } from '../../types/config';

// --- Test Helpers ---

const defaultThresholds: ThresholdConfig = {
  minOptimalHours: 140,
  maxOptimalHours: 176,
};

const defaultBufferConfigs = new Map<string, BufferConfig>();

function makeTimesheet(
  workbookId: string,
  resourceName: string,
  entries: { date: string; taskDescription: string; hoursWorked: number; projectName: string }[]
): TimesheetData {
  return {
    workbookId,
    resourceName,
    entries: entries.map(e => ({
      ...e,
      sourceDocLink: '',
    })),
  };
}

function makeWorkbook(id: string, projectName: string, month: string, year: number): WorkbookMetadata {
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

// --- aggregateByResource Tests ---

describe('aggregateByResource', () => {
  it('should return empty array for empty input', () => {
    const result = aggregateByResource([], defaultThresholds, defaultBufferConfigs);
    expect(result).toEqual([]);
  });

  it('should aggregate hours for a single resource in a single month', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 8, projectName: 'ProjectX' },
        { date: '2026-07-02', taskDescription: 'Task B', hoursWorked: 7, projectName: 'ProjectX' },
        { date: '2026-07-03', taskDescription: 'Task C', hoursWorked: 6, projectName: 'ProjectX' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].resourceName).toBe('Alice');
    expect(result[0].month).toBe('July');
    expect(result[0].year).toBe(2026);
    expect(result[0].totalHours).toBe(21);
    expect(result[0].projects).toEqual([{ projectName: 'ProjectX', hours: 21 }]);
    expect(result[0].taskCount).toBe(3);
  });

  it('should perform case-insensitive resource name matching across workbooks', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 80, projectName: 'ProjectX' },
      ]),
      makeTimesheet('wb2', 'alice', [
        { date: '2026-07-02', taskDescription: 'Task B', hoursWorked: 60, projectName: 'ProjectY' },
      ]),
      makeTimesheet('wb3', 'ALICE', [
        { date: '2026-07-03', taskDescription: 'Task C', hoursWorked: 20, projectName: 'ProjectZ' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    // Should aggregate into one resource entry for July 2026
    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(160);
    expect(result[0].projects).toHaveLength(3);
  });

  it('should compute project breakdown correctly across multiple projects', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 40, projectName: 'Alpha' },
        { date: '2026-07-02', taskDescription: 'Task B', hoursWorked: 30, projectName: 'Beta' },
        { date: '2026-07-03', taskDescription: 'Task C', hoursWorked: 50, projectName: 'Alpha' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(120);

    const alphaProject = result[0].projects.find(p => p.projectName === 'Alpha');
    const betaProject = result[0].projects.find(p => p.projectName === 'Beta');
    expect(alphaProject?.hours).toBe(90);
    expect(betaProject?.hours).toBe(30);
  });

  it('should count distinct tasks correctly', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Charlie', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 4, projectName: 'ProjectX' },
        { date: '2026-07-02', taskDescription: 'Task A', hoursWorked: 4, projectName: 'ProjectX' },
        { date: '2026-07-03', taskDescription: 'Task B', hoursWorked: 4, projectName: 'ProjectX' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    expect(result[0].taskCount).toBe(2); // "Task A" and "Task B"
  });

  it('should classify resources correctly based on thresholds', () => {
    const thresholds: ThresholdConfig = { minOptimalHours: 140, maxOptimalHours: 176 };

    const timesheets: TimesheetData[] = [
      // Under-utilized: 100 hours < 140
      makeTimesheet('wb1', 'Under', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 100, projectName: 'P1' },
      ]),
      // Optimally-utilized: 150 hours in [140, 176]
      makeTimesheet('wb2', 'Optimal', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 150, projectName: 'P1' },
      ]),
      // Over-utilized: 200 hours > 176
      makeTimesheet('wb3', 'Over', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 200, projectName: 'P1' },
      ]),
    ];

    const result = aggregateByResource(timesheets, thresholds, defaultBufferConfigs);

    const under = result.find(r => r.resourceName === 'Under');
    const optimal = result.find(r => r.resourceName === 'Optimal');
    const over = result.find(r => r.resourceName === 'Over');

    expect(under?.utilizationCategory).toBe('under-utilized');
    expect(optimal?.utilizationCategory).toBe('optimally-utilized');
    expect(over?.utilizationCategory).toBe('over-utilized');
  });

  it('should use buffer config for effective available hours calculation', () => {
    const bufferConfigs = new Map<string, BufferConfig>();
    bufferConfigs.set('alice', {
      workingDaysPerMonth: 22,
      dailyHourExpectation: 8,
      bufferDays: 2,
    });

    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 160, projectName: 'P1' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, bufferConfigs);

    // Effective hours = (22 - 2) * 8 = 160
    expect(result[0].effectiveAvailableHours).toBe(160);
    expect(result[0].utilizationPercentage).toBe(100);
  });

  it('should separate data by month-year for the same resource', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 80, projectName: 'P1' },
        { date: '2026-08-01', taskDescription: 'Task B', hoursWorked: 60, projectName: 'P1' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(2);
    const july = result.find(r => r.month === 'July');
    const august = result.find(r => r.month === 'August');
    expect(july?.totalHours).toBe(80);
    expect(august?.totalHours).toBe(60);
  });

  it('should trim whitespace from resource names', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', '  Alice  ', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 8, projectName: 'P1' },
      ]),
      makeTimesheet('wb2', 'Alice', [
        { date: '2026-07-02', taskDescription: 'Task', hoursWorked: 8, projectName: 'P1' },
      ]),
    ];

    const result = aggregateByResource(timesheets, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(16);
  });
});

// --- aggregateByProject Tests ---

describe('aggregateByProject', () => {
  it('should return empty array for empty input', () => {
    const result = aggregateByProject([], []);
    expect(result).toEqual([]);
  });

  it('should aggregate hours by project for a single project-month', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 40, projectName: 'Alpha' },
      ]),
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task B', hoursWorked: 50, projectName: 'Alpha' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'Alpha', 'July', 2026)];

    const result = aggregateByProject(timesheets, workbooks);

    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('Alpha');
    expect(result[0].totalHours).toBe(90);
    expect(result[0].activeResourceCount).toBe(2);
    expect(result[0].resources).toHaveLength(2);
  });

  it('should separate projects by month', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 40, projectName: 'Alpha' },
        { date: '2026-08-01', taskDescription: 'Task B', hoursWorked: 60, projectName: 'Alpha' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'Alpha', 'July', 2026)];

    const result = aggregateByProject(timesheets, workbooks);

    expect(result).toHaveLength(2);
    const july = result.find(r => r.month === 'July');
    const august = result.find(r => r.month === 'August');
    expect(july?.totalHours).toBe(40);
    expect(august?.totalHours).toBe(60);
  });

  it('should compute average utilization percentage', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 88, projectName: 'Alpha' },
      ]),
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task B', hoursWorked: 88, projectName: 'Alpha' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'Alpha', 'July', 2026)];

    const result = aggregateByProject(timesheets, workbooks);

    // total hours = 176, total effective = 2 * (22*8) = 352
    // avg utilization = (176 / 352) * 100 = 50
    expect(result[0].averageUtilizationPercentage).toBe(50);
  });

  it('should count only resources with hours > 0 as active', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 40, projectName: 'Alpha' },
      ]),
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task B', hoursWorked: 0, projectName: 'Alpha' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'Alpha', 'July', 2026)];

    const result = aggregateByProject(timesheets, workbooks);

    expect(result[0].activeResourceCount).toBe(1);
  });
});

// --- aggregateByMonth Tests ---

describe('aggregateByMonth', () => {
  it('should return empty array for empty input', () => {
    const result = aggregateByMonth([], [], defaultThresholds, defaultBufferConfigs);
    expect(result).toEqual([]);
  });

  it('should compute total team hours and capacity for a single month', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 80, projectName: 'P1' },
      ]),
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task B', hoursWorked: 100, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe('July');
    expect(result[0].year).toBe(2026);
    expect(result[0].totalTeamHours).toBe(180);
    // Default effective hours per resource = 22 * 8 = 176
    expect(result[0].totalAvailableCapacity).toBe(352); // 176 * 2
  });

  it('should compute overall utilization percentage correctly', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 176, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, defaultThresholds, defaultBufferConfigs);

    // 176 / 176 * 100 = 100
    expect(result[0].overallUtilizationPercentage).toBe(100);
  });

  it('should count resources per category correctly', () => {
    const thresholds: ThresholdConfig = { minOptimalHours: 140, maxOptimalHours: 176 };

    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Under1', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 100, projectName: 'P1' },
      ]),
      makeTimesheet('wb2', 'Under2', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 120, projectName: 'P1' },
      ]),
      makeTimesheet('wb3', 'Optimal', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 150, projectName: 'P1' },
      ]),
      makeTimesheet('wb4', 'Over', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 200, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, thresholds, defaultBufferConfigs);

    expect(result[0].categoryCounts['under-utilized']).toBe(2);
    expect(result[0].categoryCounts['optimally-utilized']).toBe(1);
    expect(result[0].categoryCounts['over-utilized']).toBe(1);
  });

  it('should include per-resource data in the resources array', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 150, projectName: 'P1' },
      ]),
      makeTimesheet('wb1', 'Bob', [
        { date: '2026-07-01', taskDescription: 'Task B', hoursWorked: 160, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, defaultThresholds, defaultBufferConfigs);

    expect(result[0].resources).toHaveLength(2);
    const alice = result[0].resources.find(r => r.resourceName === 'Alice');
    const bob = result[0].resources.find(r => r.resourceName === 'Bob');
    expect(alice?.totalHours).toBe(150);
    expect(bob?.totalHours).toBe(160);
  });

  it('should separate data by month', () => {
    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 80, projectName: 'P1' },
        { date: '2026-08-01', taskDescription: 'Task B', hoursWorked: 100, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, defaultThresholds, defaultBufferConfigs);

    expect(result).toHaveLength(2);
    const july = result.find(r => r.month === 'July');
    const august = result.find(r => r.month === 'August');
    expect(july?.totalTeamHours).toBe(80);
    expect(august?.totalTeamHours).toBe(100);
  });

  it('should use buffer configs for effective available hours', () => {
    const bufferConfigs = new Map<string, BufferConfig>();
    bufferConfigs.set('alice', {
      workingDaysPerMonth: 22,
      dailyHourExpectation: 8,
      bufferDays: 4,
    });

    const timesheets: TimesheetData[] = [
      makeTimesheet('wb1', 'Alice', [
        { date: '2026-07-01', taskDescription: 'Task', hoursWorked: 144, projectName: 'P1' },
      ]),
    ];
    const workbooks = [makeWorkbook('wb1', 'P1', 'July', 2026)];

    const result = aggregateByMonth(timesheets, workbooks, defaultThresholds, bufferConfigs);

    // Effective hours = (22 - 4) * 8 = 144
    expect(result[0].totalAvailableCapacity).toBe(144);
    expect(result[0].overallUtilizationPercentage).toBe(100);
  });
});
