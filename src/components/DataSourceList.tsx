/**
 * DataSourceList component — displays imported workbooks in a table format.
 *
 * Shows project name, month/year, origin, file size, resource count,
 * and import timestamp for each imported workbook. Provides a remove
 * button per workbook and displays an empty state when no data is imported.
 *
 * Validates: Requirements 4.1, 4.3, 4.4
 */

import { useAppContext } from '../state/AppContext';
import { VALIDATION_LIMITS } from '../constants/validation';
import type { WorkbookMetadata } from '../types';

/**
 * Formats file size in bytes to a human-readable string (KB or MB).
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats an ISO 8601 datetime string to a readable date/time string.
 */
function formatImportedAt(isoString: string): string {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Maps origin value to a display label.
 */
function formatOrigin(origin: WorkbookMetadata['origin']): string {
  return origin === 'google-drive' ? 'Google Drive' : 'Local';
}

export function DataSourceList() {
  const { state, dispatch } = useAppContext();
  const workbooks = state.workbooks.slice(0, VALIDATION_LIMITS.MAX_WORKBOOKS);

  function handleRemove(workbookId: string) {
    dispatch({ type: 'REMOVE_WORKBOOK', payload: { workbookId } });
  }

  if (workbooks.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 text-gray-500"
        data-testid="data-source-list-empty"
      >
        <svg
          className="w-12 h-12 mb-3 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium">No timesheets imported yet</p>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="data-source-list">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Project Name
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Month/Year
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Origin
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                File Size
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Resources
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Imported At
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {workbooks.map((workbook) => (
              <tr key={workbook.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {workbook.projectName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {workbook.month} {workbook.year}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      workbook.origin === 'google-drive'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {formatOrigin(workbook.origin)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {formatFileSize(workbook.fileSize)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {workbook.resourceCount}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {formatImportedAt(workbook.importedAt)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleRemove(workbook.id)}
                    className="inline-flex items-center px-2.5 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    aria-label={`Remove workbook ${workbook.projectName} ${workbook.month} ${workbook.year}`}
                    data-testid={`remove-workbook-${workbook.id}`}
                  >
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataSourceList;
