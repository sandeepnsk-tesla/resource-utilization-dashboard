/**
 * User Data Loader Service
 *
 * Fetches the user registry, individual user configs, and their Google Sheet data.
 * Caches loaded data to avoid re-fetching on tab switches.
 */

import type { UserRegistry, UserConfig, UserRegistryEntry } from '../types/users';
import type { ParseResult } from '../types/parser';
import type { WorkbookMetadata, TimesheetData } from '../types/index';
import { fetchFromGoogleDrive } from '../parsers/googleDriveFetcher';
import { parseWorkbook } from '../parsers/excelParserCore';

/** Base path for user config files (relative to the app's public folder) */
const USERS_BASE_PATH = import.meta.env.BASE_URL + 'users/';

/**
 * Fetches the user registry (list of all users and their config file paths).
 */
export async function fetchRegistry(): Promise<UserRegistry> {
  const response = await fetch(`${USERS_BASE_PATH}registry.json`);
  if (!response.ok) {
    throw new Error(`Failed to load user registry: HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches a single user's project config JSON.
 */
export async function fetchUserConfig(entry: UserRegistryEntry): Promise<UserConfig> {
  const response = await fetch(`${USERS_BASE_PATH}${entry.file}`);
  if (!response.ok) {
    throw new Error(`Failed to load config for user "${entry.name}": HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Result of loading all sheets for a user.
 */
export interface UserLoadResult {
  workbooks: WorkbookMetadata[];
  timesheets: TimesheetData[];
  warnings: string[];
  errors: string[];
}

/**
 * Fetches and parses all Google Sheet links from a user's config.
 * Returns combined workbook metadata and timesheet data.
 */
export async function loadUserSheets(config: UserConfig): Promise<UserLoadResult> {
  const result: UserLoadResult = {
    workbooks: [],
    timesheets: [],
    warnings: [],
    errors: [],
  };

  // Process each project sheet in parallel
  const promises = config.projects.map(async (project) => {
    try {
      // Fetch the Google Sheet as xlsx
      const fetchResult = await fetchFromGoogleDrive(project.sheetUrl);

      if (!fetchResult.success || !fetchResult.file) {
        result.errors.push(
          `${project.name} (${project.month} ${project.year}): ${fetchResult.error?.message || 'Failed to fetch'}`
        );
        return;
      }

      // Parse the fetched xlsx
      const parseResult: ParseResult = await parseWorkbook(fetchResult.file);

      if (!parseResult.success) {
        const errorMsg = parseResult.errors[0]?.message || 'Parse failed';
        result.errors.push(`${project.name} (${project.month} ${project.year}): ${errorMsg}`);
        return;
      }

      // Override metadata with info from the user's JSON config
      const metadata: WorkbookMetadata = {
        ...parseResult.workbookMetadata,
        projectName: project.name,
        month: project.month,
        year: project.year,
        origin: 'google-drive',
        fileName: fetchResult.fileName || `${project.name}_${project.month}_${project.year}.xlsx`,
      };

      result.workbooks.push(metadata);
      result.timesheets.push(...parseResult.timesheets);

      // Collect warnings
      for (const w of parseResult.warnings) {
        result.warnings.push(`${project.name}: ${w.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      result.errors.push(`${project.name} (${project.month} ${project.year}): ${msg}`);
    }
  });

  await Promise.all(promises);
  return result;
}
