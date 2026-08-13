/**
 * FileImport component for importing Excel workbooks from local disk or Google Drive.
 * Handles file selection, URL validation, parsing, duplicate detection, and dispatching.
 *
 * Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.5
 */

import { useState, useRef, useCallback } from 'react';
import { useAppContext } from '../state/AppContext';
import { parseWorkbook } from '../parsers/excelParserCore';
import { fetchFromGoogleDrive, isValidGoogleDriveUrl } from '../parsers/googleDriveFetcher';
import { detectDuplicate } from '../logic/duplicateDetector';
import type { ParseResult, ParseWarning } from '../types/parser';
import type { WorkbookMetadata, TimesheetData } from '../types/index';

/** Status types for the import process */
type ImportStatus = 'idle' | 'loading' | 'success' | 'error' | 'warning';

interface StatusMessage {
  type: ImportStatus;
  title: string;
  details?: string;
}

/** Duplicate conflict confirmation state */
interface DuplicatePrompt {
  visible: boolean;
  projectName: string;
  month: string;
  year: number;
  existingWorkbookId: string;
  pendingMetadata: WorkbookMetadata | null;
  pendingTimesheets: TimesheetData[];
}

export function FileImport() {
  const { state, dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt>({
    visible: false,
    projectName: '',
    month: '',
    year: 0,
    existingWorkbookId: '',
    pendingMetadata: null,
    pendingTimesheets: [],
  });

  /**
   * Handles the result of parsing, checking for duplicates and dispatching import.
   */
  const handleParseResult = useCallback(
    (result: ParseResult, origin: 'local' | 'google-drive') => {
      setWarnings(result.warnings);

      if (!result.success) {
        const errorMsg = result.errors.length > 0
          ? result.errors[0].message
          : 'An unknown error occurred during parsing.';
        setStatus({ type: 'error', title: errorMsg });
        setIsLoading(false);
        return;
      }

      // Update metadata origin
      const metadata: WorkbookMetadata = {
        ...result.workbookMetadata,
        origin,
      };

      // Check for duplicate project-month
      const conflict = detectDuplicate(
        { projectName: metadata.projectName, month: metadata.month, year: metadata.year },
        state.workbooks
      );

      if (conflict) {
        // Show duplicate prompt
        setDuplicatePrompt({
          visible: true,
          projectName: conflict.projectName,
          month: conflict.month,
          year: conflict.year,
          existingWorkbookId: conflict.existingWorkbookId,
          pendingMetadata: metadata,
          pendingTimesheets: result.timesheets,
        });
        setIsLoading(false);
        return;
      }

      // No conflict — dispatch import
      dispatch({
        type: 'IMPORT_WORKBOOK',
        payload: { metadata, timesheets: result.timesheets },
      });

      const warningCount = result.warnings.length;
      if (warningCount > 0) {
        setStatus({
          type: 'success',
          title: `Successfully imported "${metadata.fileName}" with ${warningCount} warning(s).`,
        });
      } else {
        setStatus({
          type: 'success',
          title: `Successfully imported "${metadata.fileName}".`,
        });
      }
      setIsLoading(false);
    },
    [state.workbooks, dispatch]
  );

  /**
   * Handles local file selection via the file input.
   */
  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setStatus(null);
      setWarnings([]);
      setWarningsExpanded(false);
      setIsLoading(true);

      try {
        const result = await parseWorkbook(file);
        handleParseResult(result, 'local');
      } catch (err) {
        setStatus({
          type: 'error',
          title: 'An unexpected error occurred while parsing the file.',
        });
        setIsLoading(false);
      }

      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleParseResult]
  );

  /**
   * Handles fetching an Excel file from Google Drive.
   */
  const handleGoogleDriveFetch = useCallback(async () => {
    const url = googleDriveUrl.trim();

    if (!url) {
      setStatus({ type: 'error', title: 'Please enter a Google Drive URL.' });
      return;
    }

    if (!isValidGoogleDriveUrl(url)) {
      setStatus({
        type: 'error',
        title: 'Invalid Google Drive link format. Please provide a valid sharing link.',
      });
      return;
    }

    setStatus(null);
    setWarnings([]);
    setWarningsExpanded(false);
    setIsLoading(true);

    try {
      const fetchResult = await fetchFromGoogleDrive(url);

      if (!fetchResult.success || !fetchResult.file) {
        const errorMsg = fetchResult.error?.message ?? 'Failed to fetch file from Google Drive.';
        setStatus({ type: 'error', title: errorMsg });
        setIsLoading(false);
        return;
      }

      // Parse the fetched file
      const result = await parseWorkbook(fetchResult.file, {
        maxFileSizeMB: 50,
        timeoutMs: 10000,
      });

      // If filename info available from fetch, update metadata
      if (fetchResult.fileName && result.success) {
        result.workbookMetadata.fileName = fetchResult.fileName;
      }

      handleParseResult(result, 'google-drive');
    } catch (err) {
      setStatus({
        type: 'error',
        title: 'An unexpected error occurred while fetching from Google Drive.',
      });
      setIsLoading(false);
    }
  }, [googleDriveUrl, handleParseResult]);

  /**
   * Handles the user choosing to replace existing data in the duplicate prompt.
   */
  const handleReplaceDuplicate = useCallback(() => {
    if (!duplicatePrompt.pendingMetadata) return;

    // Remove the existing workbook first
    dispatch({
      type: 'REMOVE_WORKBOOK',
      payload: { workbookId: duplicatePrompt.existingWorkbookId },
    });

    // Then import the new one
    dispatch({
      type: 'IMPORT_WORKBOOK',
      payload: {
        metadata: duplicatePrompt.pendingMetadata,
        timesheets: duplicatePrompt.pendingTimesheets,
      },
    });

    setStatus({
      type: 'success',
      title: `Replaced existing data for "${duplicatePrompt.projectName}" (${duplicatePrompt.month} ${duplicatePrompt.year}).`,
    });

    setDuplicatePrompt({
      visible: false,
      projectName: '',
      month: '',
      year: 0,
      existingWorkbookId: '',
      pendingMetadata: null,
      pendingTimesheets: [],
    });
  }, [duplicatePrompt, dispatch]);

  /**
   * Handles the user choosing to cancel import in the duplicate prompt.
   */
  const handleCancelDuplicate = useCallback(() => {
    setStatus({
      type: 'warning',
      title: `Import cancelled. Data for "${duplicatePrompt.projectName}" (${duplicatePrompt.month} ${duplicatePrompt.year}) was not replaced.`,
    });

    setDuplicatePrompt({
      visible: false,
      projectName: '',
      month: '',
      year: 0,
      existingWorkbookId: '',
      pendingMetadata: null,
      pendingTimesheets: [],
    });
  }, [duplicatePrompt]);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Import Workbook</h2>

      {/* Local File Import */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Import from Local File
        </label>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Select Excel file"
          />
        </div>
        <p className="text-xs text-gray-500">
          Accepts .xlsx and .xls files up to 50 MB
        </p>
      </div>

      {/* Google Drive Import */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Import from Google Drive
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={googleDriveUrl}
            onChange={(e) => setGoogleDriveUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/... or https://drive.google.com/file/d/..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm
              placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:opacity-50 disabled:bg-gray-100"
            aria-label="Google Drive URL"
          />
          <button
            onClick={handleGoogleDriveFetch}
            disabled={isLoading || !googleDriveUrl.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Fetch from Google Drive"
          >
            Fetch
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Paste a Google Sheets or Drive sharing link. The sheet must be shared as "Anyone with the link → Viewer"
        </p>
      </div>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md" role="status" aria-live="polite">
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm text-blue-700">Parsing workbook...</span>
        </div>
      )}

      {/* Status Messages */}
      {status && !isLoading && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-4 rounded-md border text-sm ${
            status.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : status.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <p className="font-medium">{status.title}</p>
          {status.details && <p className="mt-1">{status.details}</p>}
        </div>
      )}

      {/* Parsing Warnings (Expandable) */}
      {warnings.length > 0 && !isLoading && (
        <div className="border border-amber-200 rounded-md overflow-hidden">
          <button
            onClick={() => setWarningsExpanded(!warningsExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-left text-sm font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-expanded={warningsExpanded}
            aria-controls="warnings-content"
          >
            <span>⚠️ {warnings.length} Parsing Warning{warnings.length > 1 ? 's' : ''}</span>
            <svg
              className={`h-4 w-4 transition-transform ${warningsExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {warningsExpanded && (
            <div id="warnings-content" className="px-4 py-3 bg-white space-y-2">
              {warnings.map((warning, idx) => (
                <div key={idx} className="text-sm text-gray-700">
                  <p className="font-medium">{warning.message}</p>
                  {warning.details.length > 0 && (
                    <ul className="mt-1 list-disc list-inside text-xs text-gray-500">
                      {warning.details.map((detail, detailIdx) => (
                        <li key={detailIdx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Conflict Prompt */}
      {duplicatePrompt.visible && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-md space-y-3" role="alertdialog" aria-labelledby="duplicate-title" aria-describedby="duplicate-desc">
          <p id="duplicate-title" className="text-sm font-medium text-amber-900">
            Duplicate Detected
          </p>
          <p id="duplicate-desc" className="text-sm text-amber-800">
            A workbook for <strong>{duplicatePrompt.projectName}</strong> ({duplicatePrompt.month} {duplicatePrompt.year}) already exists. Would you like to replace the existing data?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleReplaceDuplicate}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md
                hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              Replace existing data
            </button>
            <button
              onClick={handleCancelDuplicate}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-md border border-gray-300
                hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
