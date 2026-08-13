/**
 * Resources View - Resource-focused dashboard view.
 * Displays resource-wise utilization across all assigned projects.
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAppContext } from '../state/AppContext';
import {
  useFilteredResourceData,
  useAvailableResources,
} from '../state/selectors';
import { FilterBar } from '../components/FilterBar';
import { UTILIZATION_COLORS } from '../constants/validation';
import { HorizontalBarChart } from '../components/charts/HorizontalBarChart';
import type { UtilizationCategory } from '../types/config';
import type { HorizontalBarChartDataItem } from '../components/charts/HorizontalBarChart';

/** Category label for display */
const CATEGORY_LABELS: Record<UtilizationCategory, string> = {
  'over-utilized': 'Over-Utilized',
  'under-utilized': 'Under-Utilized',
  'optimally-utilized': 'Optimally Utilized',
};

/** Badge component for utilization category */
function CategoryBadge({ category }: { category: UtilizationCategory }) {
  const color = UTILIZATION_COLORS[category];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

export function ResourcesView() {
  const { state } = useAppContext();
  const resources = useAvailableResources();
  const resourceData = useFilteredResourceData();

  const [selectedResource, setSelectedResource] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Get months available for the selected resource
  const resourceMonths = useMemo(() => {
    if (!selectedResource) return [];
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const months = resourceData
      .filter((r) => r.resourceName.toLowerCase() === selectedResource.toLowerCase())
      .map((r) => `${r.month} ${r.year}`);

    const uniqueMonths = Array.from(new Set(months));
    return uniqueMonths.sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      return monthOrder.indexOf(monthA) - monthOrder.indexOf(monthB);
    });
  }, [resourceData, selectedResource]);

  // Auto-select first month when resource changes
  const effectiveMonth = useMemo(() => {
    if (selectedMonth && resourceMonths.includes(selectedMonth)) {
      return selectedMonth;
    }
    return resourceMonths.length > 0 ? resourceMonths[0] : '';
  }, [selectedMonth, resourceMonths]);

  // Filter data for selected resource and month
  const currentResourceData = useMemo(() => {
    if (!selectedResource || !effectiveMonth) return null;
    const [month, yearStr] = effectiveMonth.split(' ');
    const year = parseInt(yearStr);
    return resourceData.find(
      (r) =>
        r.resourceName.toLowerCase() === selectedResource.toLowerCase() &&
        r.month === month &&
        r.year === year
    ) || null;
  }, [resourceData, selectedResource, effectiveMonth]);

  // Build horizontal bar chart data from current resource's projects
  const barChartData: HorizontalBarChartDataItem[] = useMemo(() => {
    if (!currentResourceData) return [];
    return currentResourceData.projects
      .map((p) => ({
        projectName: p.projectName,
        hours: p.hours,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [currentResourceData]);

  // Build trend line data (all months for the selected resource)
  const trendData = useMemo(() => {
    if (!selectedResource) return [];
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return resourceData
      .filter((r) => r.resourceName.toLowerCase() === selectedResource.toLowerCase())
      .sort((a, b) => {
        const yearDiff = a.year - b.year;
        if (yearDiff !== 0) return yearDiff;
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      })
      .map((r) => ({
        month: `${r.month} ${r.year}`,
        totalHours: r.totalHours,
      }));
  }, [resourceData, selectedResource]);

  // Get buffer days for current resource and month
  const bufferDays = useMemo(() => {
    if (!selectedResource || !effectiveMonth) return 0;
    const resourceBuffers = state.config.resourceBufferDays[selectedResource];
    if (!resourceBuffers) return 0;
    return resourceBuffers[effectiveMonth] || 0;
  }, [state.config.resourceBufferDays, selectedResource, effectiveMonth]);

  // No resources available at all
  if (resources.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-gray-800">Resources</h2>
        <p className="mt-4 text-gray-500">
          Import timesheet data to view resource utilization details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar />

      {/* Header with resource and month selectors */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">Resources</h2>
        <div className="flex items-center gap-3">
          {/* Resource selector */}
          <div className="w-60">
            <label htmlFor="resource-selector" className="sr-only">
              Select a resource
            </label>
            <select
              id="resource-selector"
              value={selectedResource}
              onChange={(e) => {
                setSelectedResource(e.target.value);
                setSelectedMonth('');
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a resource...</option>
              {resources.map((resource) => (
                <option key={resource} value={resource}>
                  {resource}
                </option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          {selectedResource && resourceMonths.length > 0 && (
            <div className="w-48">
              <label htmlFor="month-selector" className="sr-only">
                Select a month
              </label>
              <select
                id="month-selector"
                value={effectiveMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {resourceMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* No resource selected yet */}
      {!selectedResource && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>Select a resource engineer to view their workload details</p>
        </div>
      )}

      {/* Resource selected but no data for chosen month (Requirement 9.6) */}
      {selectedResource && effectiveMonth && !currentResourceData && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>No timesheet data found for {selectedResource} in {effectiveMonth}</p>
        </div>
      )}

      {/* Resource selected with no months at all */}
      {selectedResource && resourceMonths.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>No timesheet data found for {selectedResource}</p>
        </div>
      )}

      {/* Resource data available */}
      {selectedResource && currentResourceData && (
        <>
          {/* Summary Card (Requirement 9.2) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resource Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {currentResourceData.totalHours.toFixed(1)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Projects Assigned</p>
                <p className="text-2xl font-bold text-gray-900">
                  {currentResourceData.projects.length}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Category</p>
                <div className="mt-1">
                  <CategoryBadge category={currentResourceData.utilizationCategory} />
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Buffer Days</p>
                <p className="text-2xl font-bold text-gray-900">{bufferDays}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Effective Available Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {currentResourceData.effectiveAvailableHours.toFixed(1)}
                </p>
              </div>
            </div>
          </div>

          {/* Horizontal Bar Chart - per-project hours (Requirement 9.3) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Hours per Project — {effectiveMonth}
            </h3>
            <HorizontalBarChart data={barChartData} />
          </div>

          {/* Trend Line Chart with threshold bands (Requirements 9.4, 9.5) */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Monthly Utilization Trend
            </h3>
            {trendData.length >= 2 ? (
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    {/* Min threshold - green dashed line */}
                    <ReferenceLine
                      y={state.config.thresholds.minOptimalHours}
                      stroke="#43A047"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `Min: ${state.config.thresholds.minOptimalHours}h`,
                        position: 'right',
                        fill: '#43A047',
                        fontSize: 12,
                      }}
                    />
                    {/* Max threshold - red dashed line */}
                    <ReferenceLine
                      y={state.config.thresholds.maxOptimalHours}
                      stroke="#E53935"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{
                        value: `Max: ${state.config.thresholds.maxOptimalHours}h`,
                        position: 'right',
                        fill: '#E53935',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalHours"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 5, fill: '#3B82F6' }}
                      activeDot={{ r: 7 }}
                      name="Total Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : trendData.length === 1 ? (
              /* Single data point (Requirement 9.5) */
              <div className="text-center">
                <div className="w-full h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis
                        label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip />
                      <ReferenceLine
                        y={state.config.thresholds.minOptimalHours}
                        stroke="#43A047"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                      <ReferenceLine
                        y={state.config.thresholds.maxOptimalHours}
                        stroke="#E53935"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="totalHours"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ r: 6, fill: '#3B82F6' }}
                        name="Total Hours"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Import additional months to view trends
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No trend data available
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
