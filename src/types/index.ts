/**
 * Core data models for the Resource Utilization Dashboard.
 * These interfaces represent the primary domain entities used throughout the application.
 */

import type { UtilizationCategory } from './config';

/** Metadata for an imported Excel workbook */
export interface WorkbookMetadata {
  id: string;                // UUID
  projectName: string;
  month: string;             // Full month name e.g. "July"
  year: number;              // 4-digit year e.g. 2026
  fileName: string;
  origin: 'local' | 'google-drive';
  fileSize: number;          // bytes
  importedAt: string;        // ISO 8601 datetime
  resourceCount: number;
}

/** Individual timesheet entry (one row in a sheet) */
export interface TimesheetEntry {
  date: string;              // ISO 8601 date e.g. "2026-07-15"
  taskDescription: string;   // max 500 chars
  hoursWorked: number;       // 0-24
  projectName: string;
  sourceDocLink: string;     // valid URL or ""
}

/** A resource's full timesheet for one workbook */
export interface TimesheetData {
  workbookId: string;
  resourceName: string;
  entries: TimesheetEntry[];
}

/** Aggregated data for a resource in a given month */
export interface AggregatedResourceData {
  resourceName: string;
  month: string;
  year: number;
  totalHours: number;
  projects: ProjectHours[];
  taskCount: number;
  effectiveAvailableHours: number;
  utilizationCategory: UtilizationCategory;
  utilizationPercentage: number;
}

/** Hours worked on a specific project */
export interface ProjectHours {
  projectName: string;
  hours: number;
}

/** Aggregated project data */
export interface AggregatedProjectData {
  projectName: string;
  month: string;
  year: number;
  totalHours: number;
  activeResourceCount: number;
  resources: { resourceName: string; hours: number; category: UtilizationCategory }[];
  averageUtilizationPercentage: number;
}

/** Aggregated monthly data */
export interface AggregatedMonthData {
  month: string;
  year: number;
  totalTeamHours: number;
  totalAvailableCapacity: number;
  overallUtilizationPercentage: number;
  categoryCounts: Record<UtilizationCategory, number>;
  resources: AggregatedResourceData[];
}
