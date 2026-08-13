/**
 * Filename parser module for extracting project metadata from workbook filenames.
 * Expected convention: {ProjectName}_{Month}_{Year}.xlsx
 */

import type { FilenameMetadata } from '../types/parser';
import { VALID_MONTHS } from '../constants/validation';

/**
 * Parses a workbook filename to extract the project name, month, and year.
 *
 * Expected filename convention: `{ProjectName}_{Month}_{Year}.xlsx`
 * - ProjectName: any non-empty string (cannot contain underscores)
 * - Month: full English month name (case-insensitive)
 * - Year: 4-digit number
 *
 * @param filename - The workbook filename to parse
 * @returns FilenameMetadata with extracted values and validity flag
 */
export function parseFilename(filename: string): FilenameMetadata {
  const invalid: FilenameMetadata = {
    projectName: '',
    month: '',
    year: 0,
    isValid: false,
  };

  if (!filename || typeof filename !== 'string') {
    return invalid;
  }

  const trimmed = filename.trim();

  // Remove .xlsx or .xls extension (case-insensitive)
  const extensionMatch = trimmed.match(/\.(xlsx|xls)$/i);
  if (!extensionMatch) {
    return invalid;
  }

  const withoutExtension = trimmed.slice(0, -extensionMatch[0].length);

  // Split by underscore — expect exactly 3 parts: ProjectName, Month, Year
  const parts = withoutExtension.split('_');
  if (parts.length !== 3) {
    return invalid;
  }

  const [rawProjectName, rawMonth, rawYear] = parts;

  // Validate project name: must be non-empty after trimming
  const projectName = rawProjectName.trim();
  if (!projectName) {
    return invalid;
  }

  // Validate month: must be a valid full English month name (case-insensitive)
  const monthTrimmed = rawMonth.trim();
  const matchedMonth = VALID_MONTHS.find(
    (m) => m.toLowerCase() === monthTrimmed.toLowerCase()
  );
  if (!matchedMonth) {
    return invalid;
  }

  // Validate year: must be a 4-digit numeric string
  const yearTrimmed = rawYear.trim();
  if (!/^\d{4}$/.test(yearTrimmed)) {
    return invalid;
  }

  const year = parseInt(yearTrimmed, 10);

  return {
    projectName,
    month: matchedMonth,
    year,
    isValid: true,
  };
}
