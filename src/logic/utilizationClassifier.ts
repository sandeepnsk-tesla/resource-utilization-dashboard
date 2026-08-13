/**
 * Utilization Classifier Module
 *
 * Classifies resources based on configured thresholds and buffer days.
 * Calculates effective available hours and utilization percentage.
 *
 * Requirements: 5.2, 5.3, 5.4, 6.4
 */

import type { ThresholdConfig, BufferConfig, UtilizationCategory } from '../types/config';
import { VALIDATION_LIMITS } from '../constants/validation';

/** Result of classifying a resource's utilization */
export interface ClassificationResult {
  category: UtilizationCategory;
  totalHours: number;
  effectiveAvailableHours: number;
  utilizationPercentage: number;
}

/**
 * Calculates effective available hours for a resource.
 * Formula: (workingDaysPerMonth - bufferDays) x dailyHourExpectation
 */
export function calculateEffectiveAvailableHours(bufferConfig: BufferConfig): number {
  const { workingDaysPerMonth, bufferDays, dailyHourExpectation } = bufferConfig;
  return (workingDaysPerMonth - bufferDays) * dailyHourExpectation;
}

/**
 * Classifies a resource's utilization based on total hours worked,
 * threshold configuration, and buffer/working day settings.
 *
 * Classification:
 * - under-utilized: totalHours < minOptimalHours
 * - over-utilized: totalHours > maxOptimalHours
 * - optimally-utilized: minOptimalHours <= totalHours <= maxOptimalHours
 *
 * Utilization percentage = (totalHours / effectiveAvailableHours) x 100
 */
export function classifyResource(
  totalHours: number,
  thresholds: ThresholdConfig,
  bufferConfig: BufferConfig
): ClassificationResult {
  const effectiveAvailableHours = calculateEffectiveAvailableHours(bufferConfig);

  const utilizationPercentage =
    effectiveAvailableHours > 0 ? (totalHours / effectiveAvailableHours) * 100 : 0;

  let category: UtilizationCategory;

  if (totalHours < thresholds.minOptimalHours) {
    category = 'under-utilized';
  } else if (totalHours > thresholds.maxOptimalHours) {
    category = 'over-utilized';
  } else {
    category = 'optimally-utilized';
  }

  return {
    category,
    totalHours,
    effectiveAvailableHours,
    utilizationPercentage,
  };
}


/**
 * Validates that threshold configuration is valid.
 * Returns true if min < max and both are within [0, 744].
 */
export function validateThresholds(min: number, max: number): boolean {
  return (
    min < max &&
    min >= VALIDATION_LIMITS.MIN_THRESHOLD &&
    min <= VALIDATION_LIMITS.MAX_THRESHOLD &&
    max >= VALIDATION_LIMITS.MIN_THRESHOLD &&
    max <= VALIDATION_LIMITS.MAX_THRESHOLD
  );
}

/**
 * Validates that buffer days configuration is valid.
 * Returns true if 0 <= bufferDays < workingDays.
 */
export function validateBufferDays(bufferDays: number, workingDays: number): boolean {
  return bufferDays >= 0 && bufferDays < workingDays;
}
