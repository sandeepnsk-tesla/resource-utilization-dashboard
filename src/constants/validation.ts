/**
 * Validation constants defining input boundaries and limits
 * for the Resource Utilization Dashboard.
 */

export const VALIDATION_LIMITS = {
  /** Maximum file size for import in megabytes */
  MAX_FILE_SIZE_MB: 50,

  /** Maximum number of workbooks that can be imported simultaneously */
  MAX_WORKBOOKS: 20,

  /** Maximum length for task description field */
  MAX_TASK_DESCRIPTION_LENGTH: 500,

  /** Minimum hours worked per day entry */
  MIN_HOURS: 0,

  /** Maximum hours worked per day entry */
  MAX_HOURS: 24,

  /** Minimum value for utilization threshold (hours per month) */
  MIN_THRESHOLD: 0,

  /** Maximum value for utilization threshold (hours per month) */
  MAX_THRESHOLD: 744,

  /** Minimum configurable working days per month */
  MIN_WORKING_DAYS: 1,

  /** Maximum configurable working days per month */
  MAX_WORKING_DAYS: 31,

  /** Minimum daily hour expectation */
  MIN_DAILY_HOURS: 1,

  /** Maximum daily hour expectation */
  MAX_DAILY_HOURS: 24,

  /** Google Drive download timeout in milliseconds */
  GOOGLE_DRIVE_TIMEOUT_MS: 30000,

  /** AI provider response timeout in milliseconds */
  AI_PROVIDER_TIMEOUT_MS: 15000,

  /** Excel parsing timeout in milliseconds */
  PARSE_TIMEOUT_MS: 10000,

  /** Maximum AI insights to display */
  MAX_AI_INSIGHTS: 20,

  /** Maximum length for AI insight title */
  MAX_INSIGHT_TITLE_LENGTH: 100,

  /** Maximum length for AI insight description */
  MAX_INSIGHT_DESCRIPTION_LENGTH: 500,
} as const;

/** Default threshold values for utilization classification */
export const DEFAULT_THRESHOLDS = {
  MIN_OPTIMAL_HOURS: 140,
  MAX_OPTIMAL_HOURS: 176,
} as const;

/** Default buffer/working day configuration values */
export const DEFAULT_BUFFER_CONFIG = {
  WORKING_DAYS_PER_MONTH: 22,
  DAILY_HOUR_EXPECTATION: 8,
  BUFFER_DAYS: 0,
} as const;

/** Required column headers for a valid timesheet sheet (case-insensitive matching) */
export const REQUIRED_COLUMNS = [
  'Date',
  'Task Description',
  'Hours Worked',
  'Project Name',
  'Source Document Link',
] as const;

/**
 * Alternative column name mappings (lowercase key → canonical column name).
 * Used to support different timesheet formats from various teams/clients.
 */
export const ALTERNATIVE_COLUMN_MAPPINGS: Record<string, string> = {
  'no. of hours': 'Hours Worked',
  'tasks': 'Task Description',
  'weekday': 'Weekday', // optional, ignored during parsing
};

/**
 * Minimum required columns for a sheet to be considered a valid timesheet.
 * A sheet must have at least a "Date" column and one hours column
 * (either "Hours Worked" or "No. of Hours").
 */
export const MINIMUM_REQUIRED_COLUMNS = ['Date'] as const;

/**
 * Acceptable hours column names (case-insensitive).
 * At least one of these must be present for a sheet to be valid.
 */
export const HOURS_COLUMN_VARIANTS = ['Hours Worked', 'No. of Hours'] as const;

/**
 * Sheet names that indicate a summary/consolidated sheet (case-insensitive partial match).
 * These sheets are skipped during parsing.
 */
export const SUMMARY_SHEET_INDICATORS = ['consolidated', 'summary', 'overview'] as const;

/**
 * Sheet names that are exact matches for summary sheets (case-insensitive).
 * These are checked separately from partial matches to avoid false positives.
 */
export const SUMMARY_SHEET_EXACT_NAMES = ['all', 'total', 'index', 'sheet1'] as const;

/** Valid month names for filename parsing */
export const VALID_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Google Drive URL patterns for validation */
export const GOOGLE_DRIVE_PATTERNS = [
  /^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/,
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([^/]+)/,
] as const;

/** Accepted Excel file extensions */
export const ACCEPTED_FILE_EXTENSIONS = ['.xlsx', '.xls'] as const;

/** Color codes for utilization categories */
export const UTILIZATION_COLORS = {
  'over-utilized': '#E53935',
  'under-utilized': '#FFA726',
  'optimally-utilized': '#43A047',
} as const;
