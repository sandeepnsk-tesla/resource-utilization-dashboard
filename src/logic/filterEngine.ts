/**
 * Filter Engine Module
 *
 * Applies multi-dimensional filters with AND/OR logic to aggregated resource data.
 * - AND logic between dimensions (project AND month AND resource AND category)
 * - OR logic within each dimension (e.g., selecting multiple resources shows data for all selected)
 * - Empty filter arrays are treated as "all selected" (no filtering on that dimension)
 */

import type { AggregatedResourceData } from '../types/index';
import type { FilterState } from '../types/config';

/**
 * Applies multi-dimensional filters to aggregated resource data.
 *
 * For each dimension in FilterState:
 *   - If the array is empty → skip that dimension (no filtering)
 *   - If the array has values → keep only items matching at least one value (OR within)
 * All non-empty dimensions are applied together (AND between dimensions).
 *
 * @param data - Array of aggregated resource data to filter
 * @param filters - The current filter state with project, resource, month, and category filters
 * @returns Filtered array of aggregated resource data
 */
export function applyFilters(
  data: AggregatedResourceData[],
  filters: FilterState
): AggregatedResourceData[] {
  return data.filter((item) => {
    // Projects filter: check if any of the resource's projects array contains a matching project name
    if (filters.projects.length > 0) {
      const projectNames = item.projects.map((p) => p.projectName.toLowerCase());
      const matchesProject = filters.projects.some((filterProject) =>
        projectNames.includes(filterProject.toLowerCase())
      );
      if (!matchesProject) return false;
    }

    // Resources filter: match on resourceName (case-insensitive)
    if (filters.resources.length > 0) {
      const matchesResource = filters.resources.some(
        (filterResource) =>
          filterResource.toLowerCase() === item.resourceName.toLowerCase()
      );
      if (!matchesResource) return false;
    }

    // Months filter: match on month + year combination (format "Month Year", e.g., "July 2026")
    if (filters.months.length > 0) {
      const itemMonthYear = `${item.month} ${item.year}`;
      const matchesMonth = filters.months.some(
        (filterMonth) => filterMonth.toLowerCase() === itemMonthYear.toLowerCase()
      );
      if (!matchesMonth) return false;
    }

    // Categories filter: match on utilizationCategory
    if (filters.categories.length > 0) {
      const matchesCategory = filters.categories.includes(item.utilizationCategory);
      if (!matchesCategory) return false;
    }

    return true;
  });
}
