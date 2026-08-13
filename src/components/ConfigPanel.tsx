/**
 * Configuration Panel Component
 *
 * Provides a slideover panel for configuring utilization thresholds,
 * working days, daily hour expectations, and per-resource buffer days.
 *
 * Requirements: 5.1, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.5, 6.6
 */

import { useState, useEffect } from 'react';
import { useAppContext } from '../state/AppContext';
import { validateThresholds, validateBufferDays } from '../logic/utilizationClassifier';
import { VALIDATION_LIMITS } from '../constants/validation';

/** Props for the ConfigPanel component */
interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigPanel({ isOpen, onClose }: ConfigPanelProps) {
  const { state, dispatch } = useAppContext();

  // Local form state initialized from global config
  const [minOptimalHours, setMinOptimalHours] = useState(state.config.thresholds.minOptimalHours);
  const [maxOptimalHours, setMaxOptimalHours] = useState(state.config.thresholds.maxOptimalHours);
  const [workingDays, setWorkingDays] = useState(state.config.workingDaysPerMonth);
  const [dailyHours, setDailyHours] = useState(state.config.dailyHourExpectation);
  const [bufferDays, setBufferDays] = useState<Record<string, Record<string, number>>>(
    { ...state.config.resourceBufferDays }
  );

  // Validation error state
  const [thresholdError, setThresholdError] = useState('');
  const [bufferErrors, setBufferErrors] = useState<Record<string, string>>({});

  // Sync local state when panel opens or global state changes
  useEffect(() => {
    if (isOpen) {
      setMinOptimalHours(state.config.thresholds.minOptimalHours);
      setMaxOptimalHours(state.config.thresholds.maxOptimalHours);
      setWorkingDays(state.config.workingDaysPerMonth);
      setDailyHours(state.config.dailyHourExpectation);
      setBufferDays({ ...state.config.resourceBufferDays });
      setThresholdError('');
      setBufferErrors({});
    }
  }, [isOpen, state.config]);

  // Derive unique resources from imported timesheets
  const resources = getUniqueResources();

  function getUniqueResources(): string[] {
    const seen = new Map<string, string>();
    for (const timesheet of state.timesheets) {
      const name = timesheet.resourceName.trim();
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, name);
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }

  // Derive available months from imported data
  function getAvailableMonths(): string[] {
    const monthYears = new Set<string>();
    for (const wb of state.workbooks) {
      monthYears.add(`${wb.month} ${wb.year}`);
    }
    return Array.from(monthYears).sort();
  }

  const availableMonths = getAvailableMonths();

  function getBufferDaysValue(resourceName: string, month: string): number {
    return bufferDays[resourceName]?.[month] ?? 0;
  }

  function handleBufferDayChange(resourceName: string, month: string, value: number) {
    const updated = {
      ...bufferDays,
      [resourceName]: {
        ...(bufferDays[resourceName] ?? {}),
        [month]: value,
      },
    };
    setBufferDays(updated);

    // Validate buffer days
    if (!validateBufferDays(value, workingDays)) {
      setBufferErrors((prev) => ({
        ...prev,
        [`${resourceName}_${month}`]: 'Buffer days must be less than working days',
      }));
    } else {
      setBufferErrors((prev) => {
        const next = { ...prev };
        delete next[`${resourceName}_${month}`];
        return next;
      });
    }
  }

  function handleSave() {
    // Validate thresholds
    if (!validateThresholds(minOptimalHours, maxOptimalHours)) {
      setThresholdError('Minimum must be less than the maximum');
      return;
    }
    setThresholdError('');

    // Validate all buffer days
    const newBufferErrors: Record<string, string> = {};
    for (const resourceName of Object.keys(bufferDays)) {
      for (const month of Object.keys(bufferDays[resourceName])) {
        const days = bufferDays[resourceName][month];
        if (!validateBufferDays(days, workingDays)) {
          newBufferErrors[`${resourceName}_${month}`] = 'Buffer days must be less than working days';
        }
      }
    }

    if (Object.keys(newBufferErrors).length > 0) {
      setBufferErrors(newBufferErrors);
      return;
    }

    // Dispatch all configuration updates
    dispatch({
      type: 'UPDATE_THRESHOLDS',
      payload: { minOptimalHours, maxOptimalHours },
    });

    dispatch({
      type: 'UPDATE_WORKING_DAYS',
      payload: workingDays,
    });

    dispatch({
      type: 'UPDATE_DAILY_HOURS',
      payload: dailyHours,
    });

    // Dispatch buffer days for each resource/month combination
    for (const resourceName of Object.keys(bufferDays)) {
      for (const month of Object.keys(bufferDays[resourceName])) {
        dispatch({
          type: 'UPDATE_BUFFER_DAYS',
          payload: {
            resourceName,
            month,
            days: bufferDays[resourceName][month],
          },
        });
      }
    }

    onClose();
  }

  // Validate threshold in real-time
  function handleMinChange(value: number) {
    setMinOptimalHours(value);
    if (value >= maxOptimalHours) {
      setThresholdError('Minimum must be less than the maximum');
    } else {
      setThresholdError('');
    }
  }

  function handleMaxChange(value: number) {
    setMaxOptimalHours(value);
    if (minOptimalHours >= value) {
      setThresholdError('Minimum must be less than the maximum');
    } else {
      setThresholdError('');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="config-panel-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slideover panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-md">
          <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 id="config-panel-title" className="text-lg font-semibold text-gray-900">
                Configuration
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close configuration panel"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 px-6 py-6 space-y-8">
              {/* Utilization Thresholds Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Utilization Thresholds (hours/month)
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="min-optimal-hours" className="block text-sm text-gray-700 mb-1">
                      Minimum Optimal Hours
                    </label>
                    <input
                      id="min-optimal-hours"
                      type="number"
                      min={VALIDATION_LIMITS.MIN_THRESHOLD}
                      max={VALIDATION_LIMITS.MAX_THRESHOLD}
                      value={minOptimalHours}
                      onChange={(e) => handleMinChange(Number(e.target.value))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="max-optimal-hours" className="block text-sm text-gray-700 mb-1">
                      Maximum Optimal Hours
                    </label>
                    <input
                      id="max-optimal-hours"
                      type="number"
                      min={VALIDATION_LIMITS.MIN_THRESHOLD}
                      max={VALIDATION_LIMITS.MAX_THRESHOLD}
                      value={maxOptimalHours}
                      onChange={(e) => handleMaxChange(Number(e.target.value))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  {thresholdError && (
                    <p className="text-sm text-red-600" role="alert">
                      {thresholdError}
                    </p>
                  )}
                </div>
              </section>

              {/* Working Days Section */}
              <section>
                <h3 className="text-sm font-medium text-gray-900 mb-4">
                  Working Days Configuration
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="working-days" className="block text-sm text-gray-700 mb-1">
                      Working Days per Month
                    </label>
                    <input
                      id="working-days"
                      type="number"
                      min={VALIDATION_LIMITS.MIN_WORKING_DAYS}
                      max={VALIDATION_LIMITS.MAX_WORKING_DAYS}
                      value={workingDays}
                      onChange={(e) => setWorkingDays(Number(e.target.value))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="daily-hours" className="block text-sm text-gray-700 mb-1">
                      Daily Hour Expectation
                    </label>
                    <input
                      id="daily-hours"
                      type="number"
                      min={VALIDATION_LIMITS.MIN_DAILY_HOURS}
                      max={VALIDATION_LIMITS.MAX_DAILY_HOURS}
                      value={dailyHours}
                      onChange={(e) => setDailyHours(Number(e.target.value))}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </section>

              {/* Buffer Days Section */}
              {resources.length > 0 && availableMonths.length > 0 && (
                <section>
                  <h3 className="text-sm font-medium text-gray-900 mb-4">
                    Buffer Days per Resource
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Set leave/buffer days for each resource per month (0 to {workingDays - 1} days).
                  </p>
                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Resource
                          </th>
                          {availableMonths.map((month) => (
                            <th
                              key={month}
                              className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {month}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {resources.map((resourceName) => (
                          <tr key={resourceName}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                              {resourceName}
                            </td>
                            {availableMonths.map((month) => {
                              const errorKey = `${resourceName}_${month}`;
                              return (
                                <td key={`${resourceName}_${month}`} className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={workingDays - 1}
                                    value={getBufferDaysValue(resourceName, month)}
                                    onChange={(e) =>
                                      handleBufferDayChange(resourceName, month, Number(e.target.value))
                                    }
                                    className={`w-16 rounded-md border px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
                                      bufferErrors[errorKey]
                                        ? 'border-red-300 text-red-900'
                                        : 'border-gray-300'
                                    }`}
                                    aria-label={`Buffer days for ${resourceName} in ${month}`}
                                    aria-invalid={!!bufferErrors[errorKey]}
                                  />
                                  {bufferErrors[errorKey] && (
                                    <p className="mt-1 text-xs text-red-600" role="alert">
                                      {bufferErrors[errorKey]}
                                    </p>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
