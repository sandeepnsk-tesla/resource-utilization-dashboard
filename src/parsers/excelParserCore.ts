/**
 * Excel Parser Core module.
 * Reads an Excel workbook and extracts structured timesheet data
 * using SheetJS (xlsx) for parsing.
 */

import * as XLSX from 'xlsx';
import type { ParseOptions, ParseResult, ParseWarning, ParseError } from '../types/parser';
import type { WorkbookMetadata, TimesheetData, TimesheetEntry } from '../types/index';
import {
  VALIDATION_LIMITS,
  ALTERNATIVE_COLUMN_MAPPINGS,
  MINIMUM_REQUIRED_COLUMNS,
  HOURS_COLUMN_VARIANTS,
  SUMMARY_SHEET_INDICATORS,
  SUMMARY_SHEET_EXACT_NAMES,
} from '../constants/validation';
import { parseFilename } from './filenameParser';

/** Default parse options */
const DEFAULT_OPTIONS: ParseOptions = {
  maxFileSizeMB: VALIDATION_LIMITS.MAX_FILE_SIZE_MB,
  timeoutMs: VALIDATION_LIMITS.PARSE_TIMEOUT_MS,
};

/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID() when available, otherwise falls back to a simple implementation.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Determines the size of a File or ArrayBuffer in bytes.
 */
function getFileSize(file: File | ArrayBuffer): number {
  if (file instanceof ArrayBuffer) {
    return file.byteLength;
  }
  return file.size;
}

/**
 * Gets the filename from the input. For File objects uses the name property,
 * for ArrayBuffers returns an empty string (caller should pass filename separately if needed).
 */
function getFileName(file: File | ArrayBuffer): string {
  if (file instanceof File) {
    return file.name;
  }
  return '';
}

/**
 * Reads the file content as an ArrayBuffer.
 */
async function readFileContent(file: File | ArrayBuffer): Promise<ArrayBuffer> {
  if (file instanceof ArrayBuffer) {
    return file;
  }
  return file.arrayBuffer();
}

/**
 * Checks if a sheet name indicates a summary/consolidated sheet that should be skipped.
 */
function isSummarySheet(sheetName: string): boolean {
  const normalizedName = sheetName.toLowerCase().trim();
  // Check exact name matches first
  if (SUMMARY_SHEET_EXACT_NAMES.some((name) => normalizedName === name)) {
    return true;
  }
  // Check partial matches (contains)
  return SUMMARY_SHEET_INDICATORS.some((indicator) =>
    normalizedName.includes(indicator)
  );
}

/**
 * Maps alternative column names to their canonical equivalents.
 * Returns the canonical name if a mapping exists, otherwise returns the original name.
 */
function mapToCanonicalColumn(headerName: string): string {
  const normalized = headerName.trim().toLowerCase();
  return ALTERNATIVE_COLUMN_MAPPINGS[normalized] || headerName;
}

/**
 * Checks if a header row meets the minimum requirements for a valid timesheet:
 * - Must have a "Date" column
 * - Must have at least one hours column ("Hours Worked" or "No. of Hours")
 *
 * Returns the list of missing minimum requirements, or an empty array if met.
 */
function findMissingColumns(headerRow: string[]): string[] {
  const normalizedHeaders = headerRow.map((h) => h.trim().toLowerCase());
  const missing: string[] = [];

  // Check for Date column (always required)
  for (const required of MINIMUM_REQUIRED_COLUMNS) {
    if (!normalizedHeaders.includes(required.toLowerCase())) {
      missing.push(required);
    }
  }

  // Check for at least one hours column variant
  const hasHoursColumn = HOURS_COLUMN_VARIANTS.some((variant) =>
    normalizedHeaders.includes(variant.toLowerCase())
  );
  if (!hasHoursColumn) {
    missing.push(`Hours column (one of: ${HOURS_COLUMN_VARIANTS.join(', ')})`);
  }

  return missing;
}

/**
 * Finds the column index for a given column name, checking both the exact name
 * and alternative mappings (case-insensitive).
 */
function findColumnIndex(headerRow: string[], columnName: string): number {
  const normalized = columnName.toLowerCase();
  const idx = headerRow.findIndex((h) => h.trim().toLowerCase() === normalized);
  if (idx !== -1) return idx;

  // Check if any header maps to this canonical name via alternatives
  for (let i = 0; i < headerRow.length; i++) {
    const canonical = mapToCanonicalColumn(headerRow[i]);
    if (canonical.toLowerCase() === normalized) {
      return i;
    }
  }

  return -1;
}

/**
 * Parses a date value from an Excel cell.
 * Returns an ISO 8601 date string or null if invalid.
 */
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // If it's a number, treat as Excel serial date
  if (typeof value === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(value);
      if (date && date.y && date.m && date.d) {
        const year = date.y;
        const month = String(date.m).padStart(2, '0');
        const day = String(date.d).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      return null;
    }
    return null;
  }

  // If it's a string, try to parse it as a date
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      return null;
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If it's a Date object
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Parses hours worked from a cell value.
 * Returns a clamped number (0-24) or null if invalid.
 */
function parseHours(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    num = Number(trimmed);
  } else {
    return null;
  }

  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  // Clamp to 0-24 range
  return Math.max(VALIDATION_LIMITS.MIN_HOURS, Math.min(VALIDATION_LIMITS.MAX_HOURS, num));
}

/**
 * Truncates a string to the maximum allowed length.
 */
function truncateDescription(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (str.length > VALIDATION_LIMITS.MAX_TASK_DESCRIPTION_LENGTH) {
    return str.substring(0, VALIDATION_LIMITS.MAX_TASK_DESCRIPTION_LENGTH);
  }
  return str;
}

/**
 * Extracts a string value from a cell, returning empty string for nullish values.
 */
function extractString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Parses an Excel workbook file and extracts structured timesheet data.
 *
 * @param file - The Excel file to parse (File object or ArrayBuffer)
 * @param options - Optional parsing configuration (file size limit, timeout)
 * @returns ParseResult with extracted data, warnings, and errors
 */
export async function parseWorkbook(
  file: File | ArrayBuffer,
  options?: Partial<ParseOptions>
): Promise<ParseResult> {
  const opts: ParseOptions = { ...DEFAULT_OPTIONS, ...options };
  const warnings: ParseWarning[] = [];
  const errors: ParseError[] = [];
  const timesheets: TimesheetData[] = [];

  const fileName = getFileName(file);
  const fileSize = getFileSize(file);

  // Check file size limit
  const maxSizeBytes = opts.maxFileSizeMB * 1024 * 1024;
  if (fileSize > maxSizeBytes) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File size (${(fileSize / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed size of ${opts.maxFileSizeMB} MB`,
    });
    return {
      success: false,
      workbookMetadata: createEmptyMetadata(fileName, fileSize),
      timesheets: [],
      warnings,
      errors,
    };
  }

  // Parse with timeout
  let workbook: XLSX.WorkBook;
  try {
    const content = await Promise.race([
      readFileContent(file),
      createTimeout(opts.timeoutMs),
    ]);

    if (!content) {
      errors.push({
        code: 'PARSE_TIMEOUT',
        message: `Parsing timed out after ${opts.timeoutMs / 1000} seconds`,
      });
      return {
        success: false,
        workbookMetadata: createEmptyMetadata(fileName, fileSize),
        timesheets: [],
        warnings,
        errors,
      };
    }

    workbook = XLSX.read(content as ArrayBuffer, { type: 'array', cellDates: true });
  } catch (error) {
    errors.push({
      code: 'INVALID_FORMAT',
      message: 'File is not a valid Excel format (.xlsx or .xls)',
    });
    return {
      success: false,
      workbookMetadata: createEmptyMetadata(fileName, fileSize),
      timesheets: [],
      warnings,
      errors,
    };
  }

  // Generate workbook ID
  const workbookId = generateId();

  // Process each sheet
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Skip summary/consolidated sheets
    if (isSummarySheet(sheetName)) {
      warnings.push({
        sheetName,
        type: 'skipped_sheet',
        message: `Sheet "${sheetName}" appears to be a summary/consolidated sheet and was skipped`,
        details: [],
      });
      continue;
    }

    // Convert sheet to JSON array of arrays
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (rows.length === 0) {
      warnings.push({
        sheetName,
        type: 'skipped_sheet',
        message: `Sheet "${sheetName}" is empty`,
        details: [],
      });
      continue;
    }

    // Scan the first 10 rows to find the header row (may not be row 0)
    let headerRowIndex = -1;
    let headerRow: string[] = [];
    const maxHeaderScan = Math.min(rows.length, 10);

    for (let i = 0; i < maxHeaderScan; i++) {
      const candidate = (rows[i] || []).map((cell) => String(cell ?? ''));
      const missing = findMissingColumns(candidate);
      if (missing.length === 0) {
        headerRowIndex = i;
        headerRow = candidate;
        break;
      }
    }

    if (headerRowIndex === -1) {
      // No valid header found in first 10 rows
      const firstRow = (rows[0] || []).map((cell) => String(cell ?? ''));
      const missingColumns = findMissingColumns(firstRow);
      warnings.push({
        sheetName,
        type: 'skipped_sheet',
        message: `Sheet "${sheetName}" is missing required columns: ${missingColumns.join(', ')}`,
        details: missingColumns,
      });
      continue;
    }

    // Find column indices (using flexible matching with alternative names)
    const dateIdx = findColumnIndex(headerRow, 'Date');
    const taskDescIdx = findColumnIndex(headerRow, 'Task Description');
    const hoursIdx = findColumnIndex(headerRow, 'Hours Worked');
    const projectIdx = findColumnIndex(headerRow, 'Project Name');
    const sourceIdx = findColumnIndex(headerRow, 'Source Document Link');

    // Extract resource name from sheet name (trimmed whitespace)
    const resourceName = sheetName.trim();

    // Parse data rows (start from the row AFTER the header)
    const entries: TimesheetEntry[] = [];
    const skippedRows: string[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Parse date
      const rawDate = row[dateIdx];
      const date = parseDate(rawDate);

      // Parse hours
      const rawHours = row[hoursIdx];
      const hours = parseHours(rawHours);

      // Skip rows with invalid date or non-numeric hours
      if (date === null || hours === null) {
        const reasons: string[] = [];
        if (date === null) reasons.push('invalid date');
        if (hours === null) reasons.push('invalid hours');
        skippedRows.push(`Row ${i + 1} (${reasons.join(', ')})`);
        continue;
      }

      // Extract remaining fields with defaults for missing columns
      const taskDescription = taskDescIdx !== -1 ? truncateDescription(row[taskDescIdx]) : '';
      const projectName = projectIdx !== -1 ? extractString(row[projectIdx]) : '';
      const sourceDocLink = sourceIdx !== -1 ? extractString(row[sourceIdx]) : '';

      entries.push({
        date,
        taskDescription,
        hoursWorked: hours,
        projectName,
        sourceDocLink,
      });
    }

    // Record skipped rows as warning
    if (skippedRows.length > 0) {
      warnings.push({
        sheetName,
        type: 'skipped_rows',
        message: `Skipped ${skippedRows.length} row(s) with invalid data in sheet "${sheetName}"`,
        details: skippedRows,
      });
    }

    // Add timesheet if it has any valid entries
    if (entries.length > 0) {
      timesheets.push({
        workbookId,
        resourceName,
        entries,
      });
    }
  }

  // If no valid timesheets were extracted, report error
  if (timesheets.length === 0) {
    errors.push({
      code: 'NO_VALID_DATA',
      message: 'No valid timesheet data was found in the file',
    });
    return {
      success: false,
      workbookMetadata: createEmptyMetadata(fileName, fileSize),
      timesheets: [],
      warnings,
      errors,
    };
  }
 const generateRandomInRange = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };
  // Generate workbook metadata using filename parser
  const filenameMeta = parseFilename(fileName);
  const metadata: WorkbookMetadata = {
    id: workbookId,
    projectName: filenameMeta.isValid ? filenameMeta.projectName : fileName+generateRandomInRange(1,100),
    month: filenameMeta.isValid ? filenameMeta.month : 'Unknown',
    year: filenameMeta.isValid ? filenameMeta.year : new Date().getFullYear(),
    fileName,
    origin: 'local',
    fileSize,
    importedAt: new Date().toISOString(),
    resourceCount: timesheets.length,
  };

  return {
    success: true,
    workbookMetadata: metadata,
    timesheets,
    warnings,
    errors,
  };
}

/**
 * Creates an empty workbook metadata object for error cases.
 */
function createEmptyMetadata(fileName: string, fileSize: number): WorkbookMetadata {
  return {
    id: generateId(),
    projectName: '',
    month: '',
    year: 0,
    fileName,
    origin: 'local',
    fileSize,
    importedAt: new Date().toISOString(),
    resourceCount: 0,
  };
}

/**
 * Creates a timeout promise that resolves to null after the specified duration.
 */
function createTimeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}
