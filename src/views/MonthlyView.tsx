/**
 * Monthly View
 * Displays monthly summary of team utilization with month selector,
 * summary cards, category grouping, and heatmap grid.
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
import { useState, useMemo } from 'react';
import { useAppContext } from '../state/AppContext';
import { useAggregatedMonthData, useAvailableMonths } from '../state/selectors';
import { FilterBar } from '../components/FilterBar';
import { HeatmapGrid } from '../components/charts/HeatmapGrid';
import type { UtilizationCategory } from '../types/config';

/** Color badge configuration for each utilization category */
const CATEGORY_CONFIG: Record<UtilizationCategory, { label: string; bgColor: string; textColor: string }> = {
  'over-utilized': { label: 'Over-Utilized', bgColor: 'bg-red-100', textColor: 'text-red-800' },
  'under-utilized': { label: 'Under-Utilized', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  'optimally-utilized': { label: 'Optimally Utilized', bgColor: 'bg-green-100', textColor: 'text-green-800' },
};

export function MonthlyView() {
  const { state } = useAppContext();
  const aggregatedMonths = useAggregatedMonthData();
  const availableMonths = useAvailableMonths();

  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Auto-select first available month if none selected
  const effectiveSelectedMonth = selectedMonth || (availableMonths.length > 0 ? availableMonths[0] : '');

  // Find aggregated data for the selected month
  const selectedMonthData = useMemo(() => {
    if (!effectiveSelectedMonth) return null;
    const [month, yearStr] = effectiveSelectedMonth.split(' ');
    const year = parseInt(yearStr);
    return aggregatedMonths.find((m) => m.month === month && m.year === year) ?? null;
  }, [aggregatedMonths, effectiveSelectedMonth]);

  // Filter raw timesheets for the selected month (for HeatmapGrid)
  const filteredTimesheets = useMemo(() => {
    if (!effectiveSelectedMonth) return [];
    const [month, yearStr] = effectiveSelectedMonth.split(' ');
    const year = parseInt(yearStr);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const monthIndex = monthNames.indexOf(month);
    if (monthIndex === -1) return [];

    // Filter timesheets to only include entries for the selected month/year
    return state.timesheets
      .map((ts) => ({
        ...ts,
        entries: ts.entries.filter((entry) => {
          const date = new Date(entry.date);
          return date.getMonth() === monthIndex && date.getFullYear() === year;
        }),
      }))
      .filter((ts) => ts.entries.length > 0);
  }, [state.timesheets, effectiveSelectedMonth]);

  // Parse month and year from selected month string
  const parsedMonth = effectiveSelectedMonth ? effectiveSelectedMonth.split(' ')[0] : '';
  const parsedYear = effectiveSelectedMonth ? parseInt(effectiveSelectedMonth.split(' ')[1]) : new Date().getFullYear();

  // Group resources by category for the selected month
  const resourcesByCategory = useMemo(() => {
    if (!selectedMonthData) return null;

    const groups: Record<UtilizationCategory, string[]> = {
      'over-utilized': [],
      'under-utilized': [],
      'optimally-utilized': [],
    };

    for (const resource of selectedMonthData.resources) {
      groups[resource.utilizationCategory].push(resource.resourceName);
    }

    // Sort names alphabetically within each group
    for (const category of Object.keys(groups) as UtilizationCategory[]) {
      groups[category].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    return groups;
  }, [selectedMonthData]);

  // Empty state: no data imported at all
  if (state.timesheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p className="text-lg">Import timesheet data to view monthly summaries</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar />

      {/* Month Selector */}
      <div className="flex items-center gap-4">
        <label htmlFor="month-selector" className="text-sm font-medium text-gray-700">
          Select Month:
        </label>
        <select
          id="month-selector"
          value={effectiveSelectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="block w-56 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Card */}
      {selectedMonthData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Summary — {effectiveSelectedMonth}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Team Hours */}
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Total Team Hours</p>
              <p className="text-2xl font-bold text-blue-900">
                {selectedMonthData.totalTeamHours.toFixed(1)}
              </p>
            </div>

            {/* Total Capacity */}
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">Total Capacity</p>
              <p className="text-2xl font-bold text-purple-900">
                {selectedMonthData.totalAvailableCapacity.toFixed(1)}
              </p>
            </div>

            {/* Utilization % */}
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-indigo-600 font-medium">Utilization %</p>
              <p className="text-2xl font-bold text-indigo-900">
                {selectedMonthData.overallUtilizationPercentage.toFixed(1)}%
              </p>
            </div>

            {/* Category Counts */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">Category Counts</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_CONFIG) as UtilizationCategory[]).map((category) => (
                  <span
                    key={category}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_CONFIG[category].bgColor} ${CATEGORY_CONFIG[category].textColor}`}
                  >
                    {CATEGORY_CONFIG[category].label}: {selectedMonthData.categoryCounts[category] ?? 0}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Grouping by Category */}
      {resourcesByCategory && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Resources by Category
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(CATEGORY_CONFIG) as UtilizationCategory[]).map((category) => {
              const names = resourcesByCategory[category];
              const config = CATEGORY_CONFIG[category];
              return (
                <div key={category} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-sm text-gray-500">({names.length})</span>
                  </div>
                  {names.length > 0 ? (
                    <ul className="space-y-1">
                      {names.map((name) => (
                        <li key={name} className="text-sm text-gray-700">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">None</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Heatmap Grid */}
      {effectiveSelectedMonth && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Daily Hours Heatmap — {effectiveSelectedMonth}
          </h3>
          <HeatmapGrid
            data={filteredTimesheets}
            month={parsedMonth}
            year={parsedYear}
            workingDays={state.config.workingDaysPerMonth}
          />
        </div>
      )}
    </div>
  );
}
