/**
 * FilterBar component — multi-select filter controls for all dashboard views.
 *
 * Provides multi-select dropdowns for project name, resource name, month,
 * and utilization category. Displays active filters as removable chips
 * and a "Clear All Filters" button.
 *
 * Validates: Requirements 11.1, 11.4, 11.5, 11.6
 */

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../state/AppContext';
import {
  useAvailableProjects,
  useAvailableResources,
  useAvailableMonths,
} from '../state/selectors';
import type { UtilizationCategory, FilterState } from '../types/config';

/** Fixed category options for utilization category dropdown */
const CATEGORY_OPTIONS: { label: string; value: UtilizationCategory }[] = [
  { label: 'Over-utilized', value: 'over-utilized' },
  { label: 'Under-utilized', value: 'under-utilized' },
  { label: 'Optimally-utilized', value: 'optimally-utilized' },
];

/** Maps category values to display labels */
function getCategoryLabel(value: UtilizationCategory): string {
  const option = CATEGORY_OPTIONS.find((opt) => opt.value === value);
  return option?.label ?? value;
}

// ---------------------------------------------------------------------------
// MultiSelectDropdown — reusable dropdown with checkboxes
// ---------------------------------------------------------------------------

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  testId?: string;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  testId,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleToggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const displayText =
    selected.length === 0
      ? label
      : `${label} (${selected.length})`;

  return (
    <div className="relative" ref={dropdownRef} data-testid={testId}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 min-w-[140px] justify-between"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayText}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 italic">
              No options available
            </div>
          ) : (
            options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => handleToggle(option)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="truncate">{option}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar — main export
// ---------------------------------------------------------------------------

export function FilterBar() {
  const { state, dispatch } = useAppContext();
  const { filters } = state;

  const availableProjects = useAvailableProjects();
  const availableResources = useAvailableResources();
  const availableMonths = useAvailableMonths();

  // Determine if any filters are active
  const hasActiveFilters =
    filters.projects.length > 0 ||
    filters.resources.length > 0 ||
    filters.months.length > 0 ||
    filters.categories.length > 0;

  // Dispatch SET_FILTERS for a specific dimension
  function handleFilterChange(
    dimension: keyof FilterState,
    values: string[]
  ) {
    dispatch({
      type: 'SET_FILTERS',
      payload: { [dimension]: values },
    });
  }

  // Remove a single filter value from a dimension
  function handleRemoveChip(dimension: keyof FilterState, value: string) {
    const updated = filters[dimension].filter((v) => v !== value);
    dispatch({
      type: 'SET_FILTERS',
      payload: { [dimension]: updated },
    });
  }

  // Clear all filters
  function handleClearAll() {
    dispatch({ type: 'CLEAR_FILTERS' });
  }

  return (
    <div className="w-full bg-white border-b border-gray-200 px-4 py-3" data-testid="filter-bar">
      {/* Dropdowns row */}
      <div className="flex flex-wrap items-center gap-3">
        <MultiSelectDropdown
          label="Project"
          options={availableProjects}
          selected={filters.projects}
          onChange={(values) => handleFilterChange('projects', values)}
          testId="filter-projects"
        />

        <MultiSelectDropdown
          label="Resource"
          options={availableResources}
          selected={filters.resources}
          onChange={(values) => handleFilterChange('resources', values)}
          testId="filter-resources"
        />

        <MultiSelectDropdown
          label="Month"
          options={availableMonths}
          selected={filters.months}
          onChange={(values) => handleFilterChange('months', values)}
          testId="filter-months"
        />

        <MultiSelectDropdown
          label="Category"
          options={CATEGORY_OPTIONS.map((opt) => opt.value)}
          selected={filters.categories}
          onChange={(values) =>
            handleFilterChange('categories', values as unknown as string[])
          }
          testId="filter-categories"
        />
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="filter-chips">
          {filters.projects.map((project) => (
            <FilterChip
              key={`project-${project}`}
              label={`Project: ${project}`}
              onRemove={() => handleRemoveChip('projects', project)}
            />
          ))}

          {filters.resources.map((resource) => (
            <FilterChip
              key={`resource-${resource}`}
              label={`Resource: ${resource}`}
              onRemove={() => handleRemoveChip('resources', resource)}
            />
          ))}

          {filters.months.map((month) => (
            <FilterChip
              key={`month-${month}`}
              label={`Month: ${month}`}
              onRemove={() => handleRemoveChip('months', month)}
            />
          ))}

          {filters.categories.map((category) => (
            <FilterChip
              key={`category-${category}`}
              label={`Category: ${getCategoryLabel(category)}`}
              onRemove={() => handleRemoveChip('categories', category)}
            />
          ))}

          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
            data-testid="clear-all-filters"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — removable active filter pill
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium text-blue-800 bg-blue-100 rounded-full">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 transition-colors"
        aria-label={`Remove filter: ${label}`}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </span>
  );
}

export default FilterBar;
