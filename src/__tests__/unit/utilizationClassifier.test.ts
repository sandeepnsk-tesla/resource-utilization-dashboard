import { describe, it, expect } from 'vitest';
import {
  classifyResource,
  calculateEffectiveAvailableHours,
  validateThresholds,
  validateBufferDays,
} from '../../logic/utilizationClassifier';
import type { ThresholdConfig, BufferConfig } from '../../types/config';

describe('utilizationClassifier', () => {
  const defaultThresholds: ThresholdConfig = {
    minOptimalHours: 140,
    maxOptimalHours: 176,
  };

  const defaultBufferConfig: BufferConfig = {
    workingDaysPerMonth: 22,
    dailyHourExpectation: 8,
    bufferDays: 0,
  };

  describe('classifyResource', () => {
    it('should classify as under-utilized when hours are below minimum threshold', () => {
      const result = classifyResource(100, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('under-utilized');
      expect(result.totalHours).toBe(100);
    });

    it('should classify as over-utilized when hours exceed maximum threshold', () => {
      const result = classifyResource(200, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('over-utilized');
      expect(result.totalHours).toBe(200);
    });

    it('should classify as optimally-utilized when hours are within thresholds (inclusive)', () => {
      const result = classifyResource(160, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('optimally-utilized');
      expect(result.totalHours).toBe(160);
    });

    it('should classify as optimally-utilized at exact minimum threshold', () => {
      const result = classifyResource(140, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('optimally-utilized');
    });

    it('should classify as optimally-utilized at exact maximum threshold', () => {
      const result = classifyResource(176, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('optimally-utilized');
    });

    it('should classify as under-utilized when hours are just below minimum', () => {
      const result = classifyResource(139.99, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('under-utilized');
    });

    it('should classify as over-utilized when hours are just above maximum', () => {
      const result = classifyResource(176.01, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('over-utilized');
    });

    it('should classify zero hours as under-utilized', () => {
      const result = classifyResource(0, defaultThresholds, defaultBufferConfig);
      expect(result.category).toBe('under-utilized');
      expect(result.totalHours).toBe(0);
    });

    it('should calculate correct effective available hours with no buffer days', () => {
      const result = classifyResource(160, defaultThresholds, defaultBufferConfig);
      // (22 - 0) × 8 = 176
      expect(result.effectiveAvailableHours).toBe(176);
    });

    it('should calculate correct effective available hours with buffer days', () => {
      const bufferConfig: BufferConfig = {
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        bufferDays: 3,
      };
      const result = classifyResource(160, defaultThresholds, bufferConfig);
      // (22 - 3) × 8 = 152
      expect(result.effectiveAvailableHours).toBe(152);
    });

    it('should calculate utilization percentage correctly', () => {
      const result = classifyResource(160, defaultThresholds, defaultBufferConfig);
      // (160 / 176) × 100 ≈ 90.91%
      expect(result.utilizationPercentage).toBeCloseTo(90.91, 1);
    });

    it('should handle 100% utilization', () => {
      const result = classifyResource(176, defaultThresholds, defaultBufferConfig);
      // (176 / 176) × 100 = 100%
      expect(result.utilizationPercentage).toBe(100);
    });

    it('should handle over 100% utilization', () => {
      const result = classifyResource(200, defaultThresholds, defaultBufferConfig);
      // (200 / 176) × 100 ≈ 113.64%
      expect(result.utilizationPercentage).toBeCloseTo(113.64, 1);
    });

    it('should return 0% utilization when effective available hours is 0', () => {
      const bufferConfig: BufferConfig = {
        workingDaysPerMonth: 5,
        dailyHourExpectation: 8,
        bufferDays: 5,
      };
      const result = classifyResource(100, defaultThresholds, bufferConfig);
      expect(result.utilizationPercentage).toBe(0);
      expect(result.effectiveAvailableHours).toBe(0);
    });

    it('should be deterministic — same inputs produce same output', () => {
      const result1 = classifyResource(150, defaultThresholds, defaultBufferConfig);
      const result2 = classifyResource(150, defaultThresholds, defaultBufferConfig);
      expect(result1).toEqual(result2);
    });

    it('should handle custom thresholds correctly', () => {
      const customThresholds: ThresholdConfig = {
        minOptimalHours: 100,
        maxOptimalHours: 200,
      };
      const result = classifyResource(150, customThresholds, defaultBufferConfig);
      expect(result.category).toBe('optimally-utilized');
    });
  });

  describe('calculateEffectiveAvailableHours', () => {
    it('should calculate (workingDays - bufferDays) × dailyHourExpectation', () => {
      const config: BufferConfig = {
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        bufferDays: 2,
      };
      expect(calculateEffectiveAvailableHours(config)).toBe(160);
    });

    it('should return full capacity with zero buffer days', () => {
      expect(calculateEffectiveAvailableHours(defaultBufferConfig)).toBe(176);
    });

    it('should return 0 when bufferDays equals workingDays', () => {
      const config: BufferConfig = {
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        bufferDays: 22,
      };
      expect(calculateEffectiveAvailableHours(config)).toBe(0);
    });

    it('should handle different daily hour expectations', () => {
      const config: BufferConfig = {
        workingDaysPerMonth: 20,
        dailyHourExpectation: 6,
        bufferDays: 5,
      };
      // (20 - 5) × 6 = 90
      expect(calculateEffectiveAvailableHours(config)).toBe(90);
    });
  });

  describe('validateThresholds', () => {
    it('should return true when min < max and both in [0, 744]', () => {
      expect(validateThresholds(140, 176)).toBe(true);
    });

    it('should return true for boundary values 0 and 744', () => {
      expect(validateThresholds(0, 744)).toBe(true);
    });

    it('should return true for min=0 and max=1', () => {
      expect(validateThresholds(0, 1)).toBe(true);
    });

    it('should return false when min equals max', () => {
      expect(validateThresholds(140, 140)).toBe(false);
    });

    it('should return false when min > max', () => {
      expect(validateThresholds(200, 100)).toBe(false);
    });

    it('should return false when min is negative', () => {
      expect(validateThresholds(-1, 176)).toBe(false);
    });

    it('should return false when max exceeds 744', () => {
      expect(validateThresholds(100, 745)).toBe(false);
    });

    it('should return false when min exceeds 744', () => {
      expect(validateThresholds(745, 800)).toBe(false);
    });

    it('should return false when both are negative', () => {
      expect(validateThresholds(-10, -5)).toBe(false);
    });
  });

  describe('validateBufferDays', () => {
    it('should return true when bufferDays is 0', () => {
      expect(validateBufferDays(0, 22)).toBe(true);
    });

    it('should return true when bufferDays is less than workingDays', () => {
      expect(validateBufferDays(5, 22)).toBe(true);
    });

    it('should return true for bufferDays = workingDays - 1', () => {
      expect(validateBufferDays(21, 22)).toBe(true);
    });

    it('should return false when bufferDays equals workingDays', () => {
      expect(validateBufferDays(22, 22)).toBe(false);
    });

    it('should return false when bufferDays exceeds workingDays', () => {
      expect(validateBufferDays(25, 22)).toBe(false);
    });

    it('should return false when bufferDays is negative', () => {
      expect(validateBufferDays(-1, 22)).toBe(false);
    });

    it('should handle workingDays of 1 correctly', () => {
      expect(validateBufferDays(0, 1)).toBe(true);
      expect(validateBufferDays(1, 1)).toBe(false);
    });
  });
});
