import type { TimesheetData } from '../../types';
import { VALID_MONTHS } from '../../constants/validation';

interface HeatmapGridProps {
  data: TimesheetData[];
  month: string;
  year: number;
  workingDays: number;
}

/**
 * Returns the number of days in a given month/year.
 */
function getDaysInMonth(month: string, year: number): number {
  const monthIndex = VALID_MONTHS.indexOf(month as (typeof VALID_MONTHS)[number]);
  if (monthIndex === -1) return 31;
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Returns a Set of day numbers (1-based) that fall on weekends for the given month/year.
 */
function getWeekendDays(month: string, year: number): Set<number> {
  const monthIndex = VALID_MONTHS.indexOf(month as (typeof VALID_MONTHS)[number]);
  if (monthIndex === -1) return new Set();

  const weekends = new Set<number>();
  const daysInMonth = getDaysInMonth(month, year);

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekends.add(day);
    }
  }

  return weekends;
}

/**
 * Builds a map of resourceName → day → totalHours from raw timesheet data.
 */
function buildHoursMap(
  data: TimesheetData[],
  month: string,
  year: number
): Map<string, Map<number, number>> {
  const monthIndex = VALID_MONTHS.indexOf(month as (typeof VALID_MONTHS)[number]);
  const resourceMap = new Map<string, Map<number, number>>();

  for (const timesheet of data) {
    const name = timesheet.resourceName;
    if (!resourceMap.has(name)) {
      resourceMap.set(name, new Map());
    }
    const dayMap = resourceMap.get(name)!;

    for (const entry of timesheet.entries) {
      const entryDate = new Date(entry.date);
      // Only include entries matching this month/year
      if (entryDate.getMonth() === monthIndex && entryDate.getFullYear() === year) {
        const day = entryDate.getDate();
        dayMap.set(day, (dayMap.get(day) ?? 0) + entry.hoursWorked);
      }
    }
  }

  return resourceMap;
}

/**
 * Returns the appropriate Tailwind background color class for a given hours value.
 * Color scale: white (0h) → light green → medium green → dark green (8+h)
 */
function getHeatColor(hours: number): string {
  if (hours === 0) return 'bg-white';
  if (hours <= 2) return 'bg-green-100';
  if (hours <= 4) return 'bg-green-300';
  if (hours <= 6) return 'bg-green-500';
  if (hours < 8) return 'bg-green-600';
  return 'bg-green-800';
}

/**
 * Returns text color class appropriate for the background intensity.
 */
function getTextColor(hours: number): string {
  if (hours <= 4) return 'text-gray-800';
  return 'text-white';
}

export function HeatmapGrid({ data, month, year, workingDays: _workingDays }: HeatmapGridProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>Import timesheet data to view monthly summaries</p>
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(month, year);
  const weekends = getWeekendDays(month, year);
  const hoursMap = buildHoursMap(data, month, year);

  // Filter to only resources that have at least one entry for this month
  const resourceNames = Array.from(hoursMap.entries())
    .filter(([, dayMap]) => dayMap.size > 0)
    .map(([name]) => name)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // If no resources have entries for this month, show empty state
  if (resourceNames.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <p>No data available for {month} {year}</p>
      </div>
    );
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="w-full overflow-x-auto" role="table" aria-label={`Heatmap for ${month} ${year}`}>
      {/* Legend */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-600">
        <span>Hours:</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 border border-gray-300 bg-white rounded-sm" />
          <span>0h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-green-100 rounded-sm" />
          <span>1-2h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-green-300 rounded-sm" />
          <span>3-4h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-green-500 rounded-sm" />
          <span>5-6h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-green-600 rounded-sm" />
          <span>7h</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-green-800 rounded-sm" />
          <span>8+h</span>
        </div>
        <span className="ml-3">|</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 bg-gray-200 rounded-sm" />
          <span>Weekend</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 border-2 border-red-500 bg-white rounded-sm" />
          <span>Missing entry</span>
        </div>
      </div>

      {/* Grid Table */}
      <table className="border-collapse text-xs" role="grid">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-1 text-left text-gray-700 font-medium min-w-[120px] border-b border-gray-200">
              Resource
            </th>
            {days.map((day) => (
              <th
                key={day}
                className={`px-0.5 py-1 text-center font-medium min-w-[28px] border-b border-gray-200 ${
                  weekends.has(day) ? 'text-gray-400' : 'text-gray-700'
                }`}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resourceNames.map((resourceName) => {
            const dayMap = hoursMap.get(resourceName)!;
            return (
              <tr key={resourceName} className="border-b border-gray-100">
                <td className="sticky left-0 z-10 bg-white px-2 py-1 text-gray-800 font-medium truncate max-w-[150px] border-r border-gray-200">
                  {resourceName}
                </td>
                {days.map((day) => {
                  const hours = dayMap.get(day) ?? 0;
                  const isWeekend = weekends.has(day);
                  const isZeroWeekday = hours === 0 && !isWeekend;

                  let cellClass = 'w-7 h-7 text-center rounded-sm transition-colors ';

                  if (isWeekend) {
                    cellClass += 'bg-gray-200 ';
                  } else {
                    cellClass += getHeatColor(hours) + ' ';
                  }

                  if (isZeroWeekday) {
                    cellClass += 'border-2 border-red-500 ';
                  } else {
                    cellClass += 'border border-gray-100 ';
                  }

                  const textColor = isWeekend ? 'text-gray-400' : getTextColor(hours);

                  return (
                    <td key={day} className="px-0.5 py-0.5">
                      <div
                        className={cellClass}
                        title={`${resourceName} - Day ${day}: ${hours.toFixed(1)}h${isWeekend ? ' (Weekend)' : ''}`}
                        role="gridcell"
                        aria-label={`${resourceName}, Day ${day}: ${hours.toFixed(1)} hours${isWeekend ? ' (Weekend)' : isZeroWeekday ? ' (Missing entry)' : ''}`}
                      >
                        <span className={`text-[10px] leading-7 ${textColor}`}>
                          {hours > 0 ? hours.toFixed(0) : ''}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
