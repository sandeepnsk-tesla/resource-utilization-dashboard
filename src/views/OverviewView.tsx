/**
 * Overview View
 * Displays the main dashboard overview with file import, data source list,
 * resource status list (with sortable columns and per-month utilization), metrics, and charts.
 */
import { useMemo, useState } from 'react';
import { useAppContext } from '../state/AppContext';
import { FileImport } from '../components/FileImport';
import { DataSourceList } from '../components/DataSourceList';
import { FilterBar } from '../components/FilterBar';
import { MetricsPanel } from '../components/MetricsPanel';
import { UserTabs } from '../components/UserTabs';
import { UtilizationBarChart } from '../components/charts/UtilizationBarChart';
import { DistributionDonutChart } from '../components/charts/DistributionDonutChart';
import { useFilteredResourceData, useAvailableMonths } from '../state/selectors';
import { UTILIZATION_COLORS } from '../constants/validation';
import type { UtilizationCategory } from '../types/config';
import type { AggregatedResourceData } from '../types/index';

const CATEGORY_LABELS: Record<UtilizationCategory, string> = {
  'over-utilized': 'Over-Utilized',
  'under-utilized': 'Under-Utilized',
  'optimally-utilized': 'Optimally Utilized',
};

const CATEGORY_ORDER: Record<UtilizationCategory, number> = {
  'over-utilized': 0,
  'under-utilized': 1,
  'optimally-utilized': 2,
};

/** Per-month data for a resource */
interface MonthData {
  hours: number;
  utilization: number; // percentage for that month
}

/** Aggregated resource row: one row per resource with totals across all projects/months */
interface ResourceStatusRow {
  resourceName: string;
  totalHours: number;
  monthBreakdown: Record<string, MonthData>; // "Month Year" → { hours, utilization% }
  effectiveAvailableHoursPerMonth: number; // effective hours for a single month
  totalEffectiveAvailableHours: number; // total across all months with data
  overallUtilizationPercentage: number; // total hours / total effective * 100
  projects: string[];
  utilizationCategory: UtilizationCategory;
}

/** Sort configuration */
type SortColumn = 'totalHours' | 'effectiveAvailable' | 'utilization' | 'status' | string;
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

/** Sort arrow indicator */
function SortArrow({ column, sortState }: { column: SortColumn; sortState: SortState }) {
  if (sortState.column !== column) {
    return <span className="ml-1 text-gray-300">↕</span>;
  }
  return (
    <span className="ml-1 text-blue-600">
      {sortState.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export function OverviewView() {
  const { state } = useAppContext();
  const filteredData = useFilteredResourceData();
  const availableMonths = useAvailableMonths();
  const hasData = state.workbooks.length > 0;

  const [sortState, setSortState] = useState<SortState>({
    column: 'status',
    direction: 'asc',
  });

  function handleSort(column: SortColumn) {
    setSortState((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'desc' };
    });
  }

  // Effective available hours per month (from config)
  const effectivePerMonth = useMemo(() => {
    const { workingDaysPerMonth, dailyHourExpectation } = state.config;
    return workingDaysPerMonth * dailyHourExpectation;
  }, [state.config]);

  // Aggregate filtered data into one row per resource
  const resourceStatusRows: ResourceStatusRow[] = useMemo(() => {
    if (filteredData.length === 0) return [];

    const resourceMap = new Map<string, {
      resourceName: string;
      totalHours: number;
      monthBreakdown: Record<string, number>;
      monthsWithData: number;
      projects: Set<string>;
      entries: AggregatedResourceData[];
    }>();

    for (const item of filteredData) {
      const key = item.resourceName.toLowerCase();
      if (!resourceMap.has(key)) {
        resourceMap.set(key, {
          resourceName: item.resourceName,
          totalHours: 0,
          monthBreakdown: {},
          monthsWithData: 0,
          projects: new Set(),
          entries: [],
        });
      }
      const row = resourceMap.get(key)!;
      row.totalHours += item.totalHours;
      row.entries.push(item);

      const monthKey = `${item.month} ${item.year}`;
      if (!row.monthBreakdown[monthKey]) {
        row.monthBreakdown[monthKey] = 0;
        row.monthsWithData++;
      }
      row.monthBreakdown[monthKey] += item.totalHours;

      for (const p of item.projects) {
        if (p.projectName) row.projects.add(p.projectName);
      }
    }

    // Collect project names from workbook metadata
    for (const wb of state.workbooks) {
      const wbTimesheets = state.timesheets.filter(ts => ts.workbookId === wb.id);
      for (const ts of wbTimesheets) {
        const key = ts.resourceName.trim().toLowerCase();
        if (resourceMap.has(key) && wb.projectName && wb.projectName !== 'Unknown Project') {
          resourceMap.get(key)!.projects.add(wb.projectName);
        }
      }
    }

    const rows: ResourceStatusRow[] = [];
    for (const [, data] of resourceMap) {
      // Per-month utilization: month hours / effective per month * 100
      const monthData: Record<string, MonthData> = {};
      for (const [monthKey, hours] of Object.entries(data.monthBreakdown)) {
        monthData[monthKey] = {
          hours,
          utilization: effectivePerMonth > 0 ? (hours / effectivePerMonth) * 100 : 0,
        };
      }

      const totalEffective = data.monthsWithData * effectivePerMonth;
      const overallUtilization = totalEffective > 0 ? (data.totalHours / totalEffective) * 100 : 0;

      // Category based on overall utilization against thresholds
      let category: UtilizationCategory;
      const thresholds = state.config.thresholds;
      if (data.totalHours < thresholds.minOptimalHours * data.monthsWithData) {
        category = 'under-utilized';
      } else if (data.totalHours > thresholds.maxOptimalHours * data.monthsWithData) {
        category = 'over-utilized';
      } else {
        category = 'optimally-utilized';
      }

      rows.push({
        resourceName: data.resourceName,
        totalHours: data.totalHours,
        monthBreakdown: monthData,
        effectiveAvailableHoursPerMonth: effectivePerMonth,
        totalEffectiveAvailableHours: totalEffective,
        overallUtilizationPercentage: overallUtilization,
        projects: Array.from(data.projects).sort(),
        utilizationCategory: category,
      });
    }

    return rows;
  }, [filteredData, state.config, state.workbooks, state.timesheets, effectivePerMonth]);

  // Apply sorting
  const sortedRows = useMemo(() => {
    const rows = [...resourceStatusRows];
    const { column, direction } = sortState;
    const multiplier = direction === 'asc' ? 1 : -1;

    rows.sort((a, b) => {
      let comparison = 0;

      switch (column) {
        case 'totalHours':
          comparison = a.totalHours - b.totalHours;
          break;
        case 'effectiveAvailable':
          comparison = a.totalEffectiveAvailableHours - b.totalEffectiveAvailableHours;
          break;
        case 'utilization':
          comparison = a.overallUtilizationPercentage - b.overallUtilizationPercentage;
          break;
        case 'status':
          comparison = CATEGORY_ORDER[a.utilizationCategory] - CATEGORY_ORDER[b.utilizationCategory];
          if (comparison === 0) comparison = b.totalHours - a.totalHours;
          break;
        default:
          // Month column sort
          if (column.startsWith('month:')) {
            const monthKey = column.replace('month:', '');
            const aHours = a.monthBreakdown[monthKey]?.hours || 0;
            const bHours = b.monthBreakdown[monthKey]?.hours || 0;
            comparison = aHours - bHours;
          }
          break;
      }

      return comparison * multiplier;
    });

    return rows;
  }, [resourceStatusRows, sortState]);

  function SortableHeader({ column, label, className }: { column: SortColumn; label: string; className?: string }) {
    return (
      <th
        className={`px-3 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className || 'text-left'}`}
        onClick={() => handleSort(column)}
        role="columnheader"
        aria-sort={sortState.column === column ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span className="inline-flex items-center">
          {label}
          <SortArrow column={column} sortState={sortState} />
        </span>
      </th>
    );
  }

  /** Color for per-month utilization text */
  function getUtilColor(util: number): string {
    const { minOptimalHours, maxOptimalHours } = state.config.thresholds;
    const minPct = effectivePerMonth > 0 ? (minOptimalHours / effectivePerMonth) * 100 : 0;
    const maxPct = effectivePerMonth > 0 ? (maxOptimalHours / effectivePerMonth) * 100 : 0;
    if (util < minPct) return 'text-amber-600';
    if (util > maxPct) return 'text-red-600';
    return 'text-green-600';
  }

  return (
    <div className="space-y-6">
      {/* User Project Tabs — load data from per-user JSON configs */}
      <UserTabs />

      {hasData && <FilterBar />}

      <FileImport />

      {hasData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Imported Data Sources</h3>
          <DataSourceList />
        </div>
      )}

      {hasData && <MetricsPanel />}

      {/* Resource Utilization Status — sortable, per-month utilization */}
      {hasData && sortedRows.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Resource Utilization Status
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Per-month and overall utilization across all imported projects. Click column headers to sort.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    S.No
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource Name
                  </th>
                  <SortableHeader column="totalHours" label="Total Hours" />
                  {/* Month columns with hours + utilization% */}
                  {availableMonths.map((month) => (
                    <SortableHeader
                      key={month}
                      column={`month:${month}`}
                      label={month}
                      className="text-center whitespace-nowrap"
                    />
                  ))}
                  <SortableHeader column="effectiveAvailable" label="Effective Available" />
                  <SortableHeader column="utilization" label="Overall Util %" />
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Projects
                  </th>
                  <SortableHeader column="status" label="Status" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedRows.map((resource, index) => (
                  <tr key={resource.resourceName} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {resource.resourceName}
                    </td>
                    <td className="px-3 py-3 text-gray-700 font-semibold">
                      {resource.totalHours.toFixed(1)}h
                    </td>
                    {/* Month-wise: hours + utilization % */}
                    {availableMonths.map((month) => {
                      const md = resource.monthBreakdown[month];
                      if (!md) {
                        return (
                          <td key={month} className="px-3 py-3 text-center text-gray-400">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={month} className="px-3 py-3 text-center">
                          <div className="text-gray-700">{md.hours.toFixed(1)}h</div>
                          <div className={`text-xs font-medium ${getUtilColor(md.utilization)}`}>
                            {md.utilization.toFixed(1)}%
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-gray-600">
                      {resource.totalEffectiveAvailableHours.toFixed(1)}h
                    </td>
                    <td className="px-3 py-3 font-medium">
                      <span className={getUtilColor(resource.overallUtilizationPercentage)}>
                        {resource.overallUtilizationPercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600 max-w-[200px]">
                      {resource.projects.length > 0
                        ? resource.projects.join(', ')
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap"
                        style={{ backgroundColor: UTILIZATION_COLORS[resource.utilizationCategory] }}
                      >
                        {CATEGORY_LABELS[resource.utilizationCategory]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resource Utilization</h3>
            <UtilizationBarChart data={filteredData} />
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Utilization Distribution</h3>
            <DistributionDonutChart data={filteredData} />
          </div>
        </div>
      )}
    </div>
  );
}
