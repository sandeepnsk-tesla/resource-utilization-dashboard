/**
 * Duplicate project-month detection for workbook imports.
 * Detects when a workbook with the same project name (case-insensitive)
 * and month-year combination already exists in the imported collection.
 *
 * Validates: Requirements 4.5
 */

import type { WorkbookMetadata } from '../types/index';

/** Conflict information returned when a duplicate is detected */
export interface DuplicateConflict {
  existingWorkbookId: string;
  projectName: string;
  month: string;
  year: number;
}

/**
 * Detects whether a workbook with the same project name (case-insensitive)
 * AND same month AND same year already exists in the collection.
 *
 * @param newMetadata - The metadata of the workbook being imported
 * @param existingWorkbooks - The list of already imported workbooks
 * @returns A DuplicateConflict if a match is found, otherwise null
 */
export function detectDuplicate(
  newMetadata: { projectName: string; month: string; year: number },
  existingWorkbooks: WorkbookMetadata[]
): DuplicateConflict | null {
  const normalizedNewProject = newMetadata.projectName.toLowerCase();
  const normalizedNewMonth = newMetadata.month.toLowerCase();

  for (const workbook of existingWorkbooks) {
    const normalizedExistingProject = workbook.projectName.toLowerCase();
    const normalizedExistingMonth = workbook.month.toLowerCase();

    if (
      normalizedExistingProject === normalizedNewProject &&
      normalizedExistingMonth === normalizedNewMonth &&
      workbook.year === newMetadata.year
    ) {
      return {
        existingWorkbookId: workbook.id,
        projectName: workbook.projectName,
        month: workbook.month,
        year: workbook.year,
      };
    }
  }

  return null;
}
