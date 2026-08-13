/**
 * Projects View - Project-focused dashboard view.
 * Displays project-wise utilization data and resource allocation.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
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
  Legend,
} from 'recharts';
import { useAppContext } from '../state/AppContext';
import { useAggregatedProjectData, useAvailableProjects } from '../state/selectors';
import { FilterBar } from '../components/FilterBar';
import { UTILIZATION_COLORS } from '../constants/validation';
import { StackedBarChart } from '../components/charts/StackedBarChart';
import type { UtilizationCategory } from '../types/config';

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

export function ProjectsView() {
  const { state } = useAppContext();
  const projects = useAvailableProjects();
  const projectData = useAggregatedProjectData();
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Filter project data for selected project
  const filteredProjectData = useMemo(() => {
    if (!selectedProject) return [];
    return projectData.filter(
      (p) => p.projectName.toLowerCase() === selectedProject.toLowerCase()
    );
  }, [projectData, selectedProject]);

  // Summary card data
  const summary = useMemo(() => {
    if (filteredProjectData.length === 0) return null;

    const totalHours = filteredProjectData.reduce((sum, p) => sum + p.totalHours, 0);

    // Get all unique active resources across all months
    const allResources = new Set<string>();
    for (const monthData of filteredProjectData) {
      for (const r of monthData.resources) {
        if (r.hours > 0) allResources.add(r.resourceName.toLowerCase());
      }
    }
    const activeResources = allResources.size;

    // Average utilization: total hours / sum of effective hours * 100
    const avgUtilization =
      filteredProjectData.length > 0
        ? filteredProjectData.reduce((sum, p) => sum + p.averageUtilizationPercentage, 0) /
          filteredProjectData.length
        : 0;

    // Project timeline: earliest and latest months
    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const sortedMonths = [...filteredProjectData].sort((a, b) => {
      const yearDiff = a.year - b.year;
      if (yearDiff !== 0) return yearDiff;
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
    });

    const earliest = sortedMonths[0];
    const latest = sortedMonths[sortedMonths.length - 1];
    const timeline = `${earliest.month} ${earliest.year} – ${latest.month} ${latest.year}`;

    return { totalHours, activeResources, avgUtilization, timeline };
  }, [filteredProjectData]);

  // Build resource table data (aggregated across all months for the project)
  const resourceTableData = useMemo(() => {
    if (filteredProjectData.length === 0) return [];

    const resourceMap = new Map<
      string,
      { resourceName: string; totalHours: number; taskCount: number; category: UtilizationCategory }
    >();

    for (const monthData of filteredProjectData) {
      for (const resource of monthData.resources) {
        const key = resource.resourceName.toLowerCase();
        if (!resourceMap.has(key)) {
          resourceMap.set(key, {
            resourceName: resource.resourceName,
            totalHours: 0,
            taskCount: 0,
            category: resource.category,
          });
        }
        const entry = resourceMap.get(key)!;
        entry.totalHours += resource.hours;
        // Use the most recent category classification
        entry.category = resource.category;
      }
    }

    // Compute task counts from raw timesheets for this project
    for (const timesheet of state.timesheets) {
      const key = timesheet.resourceName.trim().toLowerCase();
      if (!resourceMap.has(key)) continue;

      const projectEntries = timesheet.entries.filter(
        (e) => e.projectName.toLowerCase() === selectedProject.toLowerCase()
      );
      const distinctTasks = new Set(projectEntries.map((e) => e.taskDescription));
      const entry = resourceMap.get(key)!;
      entry.taskCount += distinctTasks.size;
    }

    return Array.from(resourceMap.values()).sort((a, b) => b.totalHours - a.totalHours);
  }, [filteredProjectData, state.timesheets, selectedProject]);

  // Build trend line chart data (requirement 8.5: month-over-month trend)
  const trendData = useMemo(() => {
    if (filteredProjectData.length < 2) return [];

    const monthOrder = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    return [...filteredProjectData]
      .sort((a, b) => {
        const yearDiff = a.year - b.year;
        if (yearDiff !== 0) return yearDiff;
        return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month);
      })
      .map((d) => ({
        month: `${d.month} ${d.year}`,
        totalHours: d.totalHours,
        activeResources: d.activeResourceCount,
      }));
  }, [filteredProjectData]);

  // No projects available at all
  if (projects.length === 0) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-semibold text-gray-800">Projects</h2>
        <p className="mt-4 text-gray-500">
          Import timesheet data to view project utilization details.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar />

      {/* Header with project selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-800">Projects</h2>
        <div className="w-72">
          <label htmlFor="project-selector" className="sr-only">
            Select a project
          </label>
          <select
            id="project-selector"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a project...</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* No project selected yet */}
      {!selectedProject && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>Select a project to view resource utilization details</p>
        </div>
      )}

      {/* Project selected but no data */}
      {selectedProject && filteredProjectData.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <p>No resource data available for this project</p>
        </div>
      )}

      {/* Project data available */}
      {selectedProject && filteredProjectData.length > 0 && summary && (
        <>
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Project Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Total Project Hours</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.totalHours.toFixed(1)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Active Resources</p>
                <p className="text-2xl font-bold text-gray-900">{summary.activeResources}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Avg Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary.avgUtilization.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Project Timeline</p>
                <p className="text-sm font-semibold text-gray-900">{summary.timeline}</p>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resource Allocation</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Task Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilization Category
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {resourceTableData.map((resource) => (
                    <tr key={resource.resourceName} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {resource.resourceName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {resource.totalHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {resource.taskCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <CategoryBadge category={resource.category} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Resource Contribution by Month
            </h3>
            <StackedBarChart data={filteredProjectData} />
          </div>

          {/* Trend Line Chart (only if 2+ months) */}
          {trendData.length >= 2 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Month-over-Month Trend
              </h3>
              <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 20, right: 60, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      angle={-30}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      yAxisId="left"
                      label={{ value: 'Total Hours', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      label={{ value: 'Active Resources', angle: 90, position: 'insideRight' }}
                      tick={{ fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="totalHours"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Total Hours"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="activeResources"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Active Resources"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
