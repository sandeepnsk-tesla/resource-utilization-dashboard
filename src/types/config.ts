/**
 * Configuration-related types for the Resource Utilization Dashboard.
 * Covers thresholds, buffer settings, app config, filters, and utilization categories.
 */

/** Utilization classification category */
export type UtilizationCategory = 'over-utilized' | 'under-utilized' | 'optimally-utilized';

/** Threshold configuration for utilization classification */
export interface ThresholdConfig {
  minOptimalHours: number; // Default: 140
  maxOptimalHours: number; // Default: 176
}

/** Buffer and working day configuration (per resource or global) */
export interface BufferConfig {
  workingDaysPerMonth: number;  // Default: 22, range 1-31
  dailyHourExpectation: number; // Default: 8, range 1-24
  bufferDays: number;           // Default: 0, per resource, 0 to workingDays-1
}

/** Full application configuration persisted to localStorage */
export interface AppConfig {
  thresholds: ThresholdConfig;
  workingDaysPerMonth: number;
  dailyHourExpectation: number;
  resourceBufferDays: Record<string, Record<string, number>>; // resourceName -> month -> days
}

/** Multi-dimensional filter state applied across all views */
export interface FilterState {
  projects: string[];              // OR within dimension
  resources: string[];             // OR within dimension
  months: string[];                // OR within dimension (format: "Month Year")
  categories: UtilizationCategory[]; // OR within dimension
}
// AND logic applied BETWEEN dimensions
