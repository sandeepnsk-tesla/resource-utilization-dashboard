/**
 * Parser-related types for Excel parsing, Google Drive fetching,
 * and JSON serialization/deserialization.
 */

import type { WorkbookMetadata, TimesheetData, TimesheetEntry } from './index';

/** Options for configuring the Excel parser */
export interface ParseOptions {
  maxFileSizeMB: number; // Default: 50
  timeoutMs: number;     // Default: 10000
}

/** Warning generated during parsing (non-fatal) */
export interface ParseWarning {
  sheetName: string;
  type: 'skipped_sheet' | 'skipped_rows';
  message: string;
  details: string[]; // Row numbers or missing columns
}

/** Error generated during parsing (fatal for the operation) */
export interface ParseError {
  code: 'INVALID_FORMAT' | 'FILE_TOO_LARGE' | 'NO_VALID_DATA' | 'PARSE_TIMEOUT';
  message: string;
}

/** Result of parsing an Excel workbook */
export interface ParseResult {
  success: boolean;
  workbookMetadata: WorkbookMetadata;
  timesheets: TimesheetData[];
  warnings: ParseWarning[];
  errors: ParseError[];
}

/** Metadata extracted from a workbook filename */
export interface FilenameMetadata {
  projectName: string;
  month: string;  // Full month name e.g. "July"
  year: number;
  isValid: boolean;
}

/** Result of fetching a file from Google Drive */
export interface FetchResult {
  success: boolean;
  file?: ArrayBuffer;
  fileName?: string;
  fileSize?: number;
  error?: {
    code: 'INVALID_LINK' | 'ACCESS_DENIED' | 'NETWORK_ERROR' | 'TIMEOUT' | 'FILE_TOO_LARGE';
    message: string;
  };
}

/** Result of serializing parsed workbook data to JSON */
export interface SerializationResult {
  success: boolean;
  json?: string;
  error?: string;
}

/** Validation error for deserialization */
export interface ValidationError {
  field: string;
  message: string;
}

/** Result of deserializing JSON back to workbook data */
export interface DeserializationResult {
  success: boolean;
  data?: ParsedWorkbookCollection;
  errors?: ValidationError[];
}

/** Serialized workbook collection structure for JSON round-trip */
export interface ParsedWorkbookCollection {
  version: string;  // Schema version for forward compatibility
  workbooks: {
    [projectMonthKey: string]: {  // e.g., "ProjectAlpha_July_2026"
      metadata: WorkbookMetadata;
      resources: {
        [resourceName: string]: TimesheetEntry[];
      };
    };
  };
}
