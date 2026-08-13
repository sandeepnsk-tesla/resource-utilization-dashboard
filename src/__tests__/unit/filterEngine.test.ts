import { describe, it, expect } from 'vitest';
import { applyFilters } from '../../logic/filterEngine';
import type { AggregatedResourceData } from '../../types/index';
import type { FilterState } from '../../types/config';

/**
 * Unit tests for the Filter Engine module.
 * Validates Requirements 11.2, 11.3
 */

// Helper to create test data
function createResourceData(
  overrides: Partial<AggregatedResourceData> = {}
): AggregatedResourceData {
  return {
    resourceName: 'John Doe',
    month: 'July',
    year: 2026,
    totalHours: 160,
    projects: [{ projectName: 'ProjectAlpha', hours: 160 }],
    taskCount: 20,
    effectiveAvailableHours: 176,
    utilizationCategory: 'optimally-utilized',
    utilizationPercentage: 90.9,
    ...overrides,
  };
}

function emptyFilters(): FilterState {
  return {
    projects: [],
    resources: [],
    months: [],
    categories: [],
  };
}

const sampleData: AggregatedResourceData[] = [
  createResourceData({
    resourceName: 'Alice Smith',
    month: 'July',
    year: 2026,
    totalHours: 180,
    projects: [
      { projectName: 'ProjectAlpha', hours: 100 },
      { projectName: 'ProjectBeta', hours: 80 },
    ],
    utilizationCategory: 'over-utilized',
    utilizationPercentage: 102.3,
  }),
  createResourceData({
    resourceName: 'Bob Johnson',
    month: 'July',
    year: 2026,
    totalHours: 120,
    projects: [{ projectName: 'ProjectBeta', hours: 120 }],
    utilizationCategory: 'under-utilized',
    utilizationPercentage: 68.2,
  }),
  createResourceData({
    resourceName: 'Alice Smith',
    month: 'August',
    year: 2026,
    totalHours: 160,
    projects: [{ projectName: 'ProjectAlpha', hours: 160 }],
    utilizationCategory: 'optimally-utilized',
    utilizationPercentage: 90.9,
  }),
  createResourceData({
    resourceName: 'Charlie Brown',
    month: 'July',
    year: 2026,
    totalHours: 150,
    projects: [
      { projectName: 'ProjectGamma', hours: 90 },
      { projectName: 'ProjectAlpha', hours: 60 },
    ],
    utilizationCategory: 'optimally-utilized',
    utilizationPercentage: 85.2,
  }),
];

describe('filterEngine - applyFilters', () => {
  describe('empty filters (all selected)', () => {
    it('returns all data when all filter arrays are empty', () => {
      const result = applyFilters(sampleData, emptyFilters());
      expect(result).toEqual(sampleData);
    });

    it('returns empty array when data is empty', () => {
      const result = applyFilters([], emptyFilters());
      expect(result).toEqual([]);
    });
  });

  describe('projects filter (OR within dimension)', () => {
    it('filters by a single project', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectBeta'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice (July) has ProjectBeta, Bob has ProjectBeta
      expect(result).toHaveLength(2);
      expect(result[0].resourceName).toBe('Alice Smith');
      expect(result[1].resourceName).toBe('Bob Johnson');
    });

    it('filters by multiple projects (OR logic)', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectBeta', 'ProjectGamma'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice (July) has ProjectBeta, Bob has ProjectBeta, Charlie has ProjectGamma
      expect(result).toHaveLength(3);
    });

    it('is case-insensitive for project names', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['projectalpha'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice (July), Alice (August), Charlie all have ProjectAlpha
      expect(result).toHaveLength(3);
    });

    it('returns empty when no items match the project filter', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['NonExistentProject'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(0);
    });
  });

  describe('resources filter (OR within dimension)', () => {
    it('filters by a single resource name', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        resources: ['Bob Johnson'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(1);
      expect(result[0].resourceName).toBe('Bob Johnson');
    });

    it('filters by multiple resources (OR logic)', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        resources: ['Alice Smith', 'Charlie Brown'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice (July), Alice (August), Charlie
      expect(result).toHaveLength(3);
    });

    it('is case-insensitive for resource names', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        resources: ['alice smith'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(2); // Alice July + Alice August
    });
  });

  describe('months filter (OR within dimension)', () => {
    it('filters by a single month-year', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        months: ['August 2026'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(1);
      expect(result[0].resourceName).toBe('Alice Smith');
      expect(result[0].month).toBe('August');
    });

    it('filters by multiple months (OR logic)', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        months: ['July 2026', 'August 2026'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(4); // All items
    });

    it('is case-insensitive for month-year matching', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        months: ['july 2026'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(3); // Alice July, Bob July, Charlie July
    });

    it('returns empty when no items match the month filter', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        months: ['December 2025'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(0);
    });
  });

  describe('categories filter (OR within dimension)', () => {
    it('filters by a single category', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        categories: ['over-utilized'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(1);
      expect(result[0].resourceName).toBe('Alice Smith');
      expect(result[0].month).toBe('July');
    });

    it('filters by multiple categories (OR logic)', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        categories: ['over-utilized', 'under-utilized'],
      };
      const result = applyFilters(sampleData, filters);
      expect(result).toHaveLength(2); // Alice July (over) + Bob (under)
    });

    it('returns empty when no items match the category filter', () => {
      const data = [
        createResourceData({ utilizationCategory: 'optimally-utilized' }),
      ];
      const filters: FilterState = {
        ...emptyFilters(),
        categories: ['over-utilized'],
      };
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(0);
    });
  });

  describe('AND logic between dimensions', () => {
    it('applies projects AND resources filters together', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectAlpha'],
        resources: ['Alice Smith'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice has ProjectAlpha in both July and August
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.resourceName === 'Alice Smith')).toBe(true);
    });

    it('applies projects AND months filters together', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectBeta'],
        months: ['July 2026'],
      };
      const result = applyFilters(sampleData, filters);
      // Only Alice (July) and Bob (July) have ProjectBeta in July
      expect(result).toHaveLength(2);
    });

    it('applies resources AND categories filters together', () => {
      const filters: FilterState = {
        ...emptyFilters(),
        resources: ['Alice Smith'],
        categories: ['optimally-utilized'],
      };
      const result = applyFilters(sampleData, filters);
      // Only Alice in August is optimally-utilized
      expect(result).toHaveLength(1);
      expect(result[0].month).toBe('August');
    });

    it('applies all four dimensions together', () => {
      const filters: FilterState = {
        projects: ['ProjectAlpha'],
        resources: ['Alice Smith'],
        months: ['July 2026'],
        categories: ['over-utilized'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice in July, has ProjectAlpha, is over-utilized
      expect(result).toHaveLength(1);
      expect(result[0].resourceName).toBe('Alice Smith');
      expect(result[0].month).toBe('July');
    });

    it('returns empty when AND combination has no matches', () => {
      const filters: FilterState = {
        projects: ['ProjectGamma'],
        resources: ['Alice Smith'],
        months: ['July 2026'],
        categories: ['over-utilized'],
      };
      const result = applyFilters(sampleData, filters);
      // Alice is over-utilized in July but doesn't have ProjectGamma
      expect(result).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles resource with no projects gracefully', () => {
      const data = [createResourceData({ projects: [] })];
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectAlpha'],
      };
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(0);
    });

    it('handles resource with multiple projects matching filter', () => {
      const data = [
        createResourceData({
          projects: [
            { projectName: 'ProjectAlpha', hours: 80 },
            { projectName: 'ProjectBeta', hours: 80 },
          ],
        }),
      ];
      const filters: FilterState = {
        ...emptyFilters(),
        projects: ['ProjectAlpha'],
      };
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
    });

    it('does not mutate the original data array', () => {
      const originalLength = sampleData.length;
      const filters: FilterState = {
        ...emptyFilters(),
        resources: ['Alice Smith'],
      };
      applyFilters(sampleData, filters);
      expect(sampleData).toHaveLength(originalLength);
    });

    it('does not mutate individual data items', () => {
      const data = [createResourceData()];
      const original = { ...data[0] };
      applyFilters(data, emptyFilters());
      expect(data[0]).toEqual(original);
    });
  });
});
