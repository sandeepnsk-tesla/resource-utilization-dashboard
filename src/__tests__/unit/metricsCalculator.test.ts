/**
 * Unit tests for the Metrics Calculator module.
 *
 * Tests: average utilization, over/under counts, available capacity,
 * highest utilized resource, trend indicators, tiebreaker logic.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import { describe, it, expect } from 'vitest';
import { calculateMetrics } from '../../logic/metricsCalculator';
import type { AggregatedResourceData } from '../../types/index';
import type { UtilizationCategory } from '../../types/config';

/**
 * Helper to create AggregatedResourceData with defaults.
 */
function makeResource(overrides: Partial<AggregatedResourceData> & { resourceName: string }): AggregatedResourceData {
  return {
    month: 'July',
    year: 2026,
    totalHours: 160,
    projects: [{ projectName: 'ProjectAlpha', hours: 160 }],
    taskCount: 20,
    effectiveAvailableHours: 176,
    utilizationCategory: 'optimally-utilized' as UtilizationCategory,
    utilizationPercentage: 90.9,
    ...overrides,
  };
}

describe('MetricsCalculator', () => {
  describe('calculateMetrics with no previous data', () => {
    it('should compute correct average utilization percentage', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 160, effectiveAvailableHours: 176 }),
        makeResource({ resourceName: 'Bob', totalHours: 140, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(data);

      // (160 + 140) / (176 + 176) * 100 = 300/352 * 100 = 85.2272... rounds to 85.2
      expect(result.averageUtilizationPercentage.value).toBe(85.2);
      expect(result.averageUtilizationPercentage.trend).toBeNull();
    });

    it('should count over-utilized and under-utilized resources', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'over-utilized' }),
        makeResource({ resourceName: 'Bob', utilizationCategory: 'over-utilized' }),
        makeResource({ resourceName: 'Charlie', utilizationCategory: 'under-utilized' }),
        makeResource({ resourceName: 'Diana', utilizationCategory: 'optimally-utilized' }),
      ];

      const result = calculateMetrics(data);

      expect(result.overUtilizedCount.value).toBe(2);
      expect(result.underUtilizedCount.value).toBe(1);
      expect(result.overUtilizedCount.trend).toBeNull();
      expect(result.underUtilizedCount.trend).toBeNull();
    });

    it('should compute total available capacity hours', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 150, effectiveAvailableHours: 176 }),
        makeResource({ resourceName: 'Bob', totalHours: 160, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(data);

      // (176 - 150) + (176 - 160) = 26 + 16 = 42
      expect(result.totalAvailableCapacityHours.value).toBe(42);
      expect(result.totalAvailableCapacityHours.trend).toBeNull();
    });

    it('should identify highest utilized resource', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 150 }),
        makeResource({ resourceName: 'Bob', totalHours: 190 }),
        makeResource({ resourceName: 'Charlie', totalHours: 170 }),
      ];

      const result = calculateMetrics(data);

      expect(result.highestUtilizedResource.value).toBe('Bob');
      expect(result.highestUtilizedResource.trend).toBeNull();
    });

    it('should handle empty data array', () => {
      const result = calculateMetrics([]);

      expect(result.averageUtilizationPercentage.value).toBe(0);
      expect(result.overUtilizedCount.value).toBe(0);
      expect(result.underUtilizedCount.value).toBe(0);
      expect(result.totalAvailableCapacityHours.value).toBe(0);
      expect(result.highestUtilizedResource.value).toBe('');
    });

    it('should handle single resource', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 160, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(data);

      // 160 / 176 * 100 = 90.909... rounds to 90.9
      expect(result.averageUtilizationPercentage.value).toBe(90.9);
      expect(result.highestUtilizedResource.value).toBe('Alice');
    });
  });

  describe('Alphabetical tiebreaker for highest utilization', () => {
    it('should pick alphabetically first resource when tied (case-insensitive)', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Charlie', totalHours: 200 }),
        makeResource({ resourceName: 'Alice', totalHours: 200 }),
        makeResource({ resourceName: 'Bob', totalHours: 200 }),
      ];

      const result = calculateMetrics(data);

      expect(result.highestUtilizedResource.value).toBe('Alice');
    });

    it('should handle case-insensitive alphabetical comparison for ties', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'bob', totalHours: 180 }),
        makeResource({ resourceName: 'Alice', totalHours: 180 }),
      ];

      const result = calculateMetrics(data);

      // 'alice' < 'bob' alphabetically
      expect(result.highestUtilizedResource.value).toBe('Alice');
    });

    it('should not use tiebreaker when no tie exists', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Zara', totalHours: 200 }),
        makeResource({ resourceName: 'Alice', totalHours: 190 }),
      ];

      const result = calculateMetrics(data);

      expect(result.highestUtilizedResource.value).toBe('Zara');
    });
  });

  describe('Trend indicators with previous month data', () => {
    it('should show "up" trend when average utilization increased', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 170, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 150, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      expect(result.averageUtilizationPercentage.trend).toBe('up');
    });

    it('should show "down" trend when average utilization decreased', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 130, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 170, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      expect(result.averageUtilizationPercentage.trend).toBe('down');
    });

    it('should show "neutral" trend when metrics are unchanged', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 160, effectiveAvailableHours: 176, utilizationCategory: 'optimally-utilized' }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 160, effectiveAvailableHours: 176, utilizationCategory: 'optimally-utilized' }),
      ];

      const result = calculateMetrics(current, previous);

      expect(result.averageUtilizationPercentage.trend).toBe('neutral');
      expect(result.overUtilizedCount.trend).toBe('neutral');
      expect(result.underUtilizedCount.trend).toBe('neutral');
      expect(result.totalAvailableCapacityHours.trend).toBe('neutral');
    });

    it('should show "up" for overUtilizedCount when it decreases (fewer is better)', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'over-utilized', totalHours: 180, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'over-utilized', totalHours: 180, effectiveAvailableHours: 176 }),
        makeResource({ resourceName: 'Bob', utilizationCategory: 'over-utilized', totalHours: 190, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      // Current: 1 over-utilized, Previous: 2 over-utilized. Lower is better → "up"
      expect(result.overUtilizedCount.trend).toBe('up');
    });

    it('should show "down" for overUtilizedCount when it increases (more is worse)', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'over-utilized', totalHours: 180, effectiveAvailableHours: 176 }),
        makeResource({ resourceName: 'Bob', utilizationCategory: 'over-utilized', totalHours: 190, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'over-utilized', totalHours: 180, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      // Current: 2, Previous: 1. Higher is worse → "down"
      expect(result.overUtilizedCount.trend).toBe('down');
    });

    it('should show "up" for underUtilizedCount when it decreases (fewer is better)', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'under-utilized', totalHours: 100, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'under-utilized', totalHours: 100, effectiveAvailableHours: 176 }),
        makeResource({ resourceName: 'Bob', utilizationCategory: 'under-utilized', totalHours: 90, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      // Current: 1, Previous: 2. Lower is better → "up"
      expect(result.underUtilizedCount.trend).toBe('up');
    });

    it('should show "up" for totalAvailableCapacity when it increases (more capacity is better)', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 140, effectiveAvailableHours: 176 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 170, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, previous);

      // Current capacity: 176-140=36, Previous: 176-170=6. Higher is better → "up"
      expect(result.totalAvailableCapacityHours.trend).toBe('up');
    });

    it('should always show null trend for highestUtilizedResource', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 190 }),
      ];
      const previous: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Bob', totalHours: 180 }),
      ];

      const result = calculateMetrics(current, previous);

      expect(result.highestUtilizedResource.trend).toBeNull();
    });

    it('should treat empty previous data array as no previous data (null trends)', () => {
      const current: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 160, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(current, []);

      expect(result.averageUtilizationPercentage.trend).toBeNull();
      expect(result.overUtilizedCount.trend).toBeNull();
      expect(result.underUtilizedCount.trend).toBeNull();
      expect(result.totalAvailableCapacityHours.trend).toBeNull();
      expect(result.highestUtilizedResource.trend).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle resources with zero effective available hours', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 100, effectiveAvailableHours: 0 }),
      ];

      const result = calculateMetrics(data);

      // When effective hours is 0, average utilization should be 0
      expect(result.averageUtilizationPercentage.value).toBe(0);
    });

    it('should handle negative available capacity (over-utilized resources)', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 200, effectiveAvailableHours: 176 }),
      ];

      const result = calculateMetrics(data);

      // 176 - 200 = -24 (over-utilized, so negative capacity)
      expect(result.totalAvailableCapacityHours.value).toBe(-24);
    });

    it('should handle all resources being optimally utilized', () => {
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', utilizationCategory: 'optimally-utilized', totalHours: 160 }),
        makeResource({ resourceName: 'Bob', utilizationCategory: 'optimally-utilized', totalHours: 155 }),
      ];

      const result = calculateMetrics(data);

      expect(result.overUtilizedCount.value).toBe(0);
      expect(result.underUtilizedCount.value).toBe(0);
    });

    it('should correctly round average utilization to 1 decimal', () => {
      // 100 / 300 * 100 = 33.333... should round to 33.3
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 100, effectiveAvailableHours: 300 }),
      ];

      const result = calculateMetrics(data);

      expect(result.averageUtilizationPercentage.value).toBe(33.3);
    });

    it('should handle rounding edge case for .x5 values', () => {
      // 175 / 200 * 100 = 87.5 → should be 87.5
      const data: AggregatedResourceData[] = [
        makeResource({ resourceName: 'Alice', totalHours: 175, effectiveAvailableHours: 200 }),
      ];

      const result = calculateMetrics(data);

      expect(result.averageUtilizationPercentage.value).toBe(87.5);
    });
  });
});
