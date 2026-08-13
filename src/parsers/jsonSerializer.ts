/**
 * JSON Serializer module for round-trip serialization of parsed timesheet data.
 * Handles serialization to JSON and deserialization back with schema validation.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type {
  SerializationResult,
  DeserializationResult,
  ParsedWorkbookCollection,
  ValidationError,
} from '../types/parser';
import type { WorkbookMetadata } from '../types/index';

/** Current schema version for forward compatibility */
const SCHEMA_VERSION = '1.0';

/**
 * Serializes a ParsedWorkbookCollection to JSON string.
 * Preserves sheet-to-resource mapping and workbook-to-project-month association.
 *
 * @param data - The parsed workbook collection to serialize
 * @returns SerializationResult with success status and JSON string or error
 */
export function serialize(data: ParsedWorkbookCollection): SerializationResult {
  try {
    const output: ParsedWorkbookCollection = {
      version: SCHEMA_VERSION,
      workbooks: data.workbooks,
    };

    const json = JSON.stringify(output, null, 2);
    return { success: true, json };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown serialization error';
    return { success: false, error: message };
  }
}

/**
 * Deserializes a JSON string back to a ParsedWorkbookCollection.
 * Validates schema on deserialization and reports specific failing fields.
 *
 * @param json - The JSON string to deserialize
 * @returns DeserializationResult with success status and data or validation errors
 */
export function deserialize(json: string): DeserializationResult {
  const errors: ValidationError[] = [];

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      success: false,
      errors: [{ field: 'root', message: 'Invalid JSON: unable to parse input string' }],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      success: false,
      errors: [{ field: 'root', message: 'Root must be a non-null object' }],
    };
  }

  const root = parsed as Record<string, unknown>;

  // Validate version field
  if (!('version' in root)) {
    errors.push({ field: 'version', message: 'Missing required field: version' });
  } else if (typeof root.version !== 'string') {
    errors.push({ field: 'version', message: 'Field "version" must be a string' });
  }

  // Validate workbooks field
  if (!('workbooks' in root)) {
    errors.push({ field: 'workbooks', message: 'Missing required field: workbooks' });
  } else if (typeof root.workbooks !== 'object' || root.workbooks === null || Array.isArray(root.workbooks)) {
    errors.push({ field: 'workbooks', message: 'Field "workbooks" must be a non-null object' });
  } else {
    // Validate each workbook entry
    const workbooks = root.workbooks as Record<string, unknown>;
    for (const [key, workbook] of Object.entries(workbooks)) {
      validateWorkbookEntry(key, workbook, errors);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: parsed as ParsedWorkbookCollection,
  };
}

/**
 * Validates a single workbook entry within the collection.
 */
function validateWorkbookEntry(
  key: string,
  workbook: unknown,
  errors: ValidationError[]
): void {
  if (typeof workbook !== 'object' || workbook === null || Array.isArray(workbook)) {
    errors.push({
      field: `workbooks.${key}`,
      message: `Workbook entry "${key}" must be a non-null object`,
    });
    return;
  }

  const entry = workbook as Record<string, unknown>;

  // Validate metadata
  if (!('metadata' in entry)) {
    errors.push({
      field: `workbooks.${key}.metadata`,
      message: `Missing required field: metadata in workbook "${key}"`,
    });
  } else {
    validateMetadata(key, entry.metadata, errors);
  }

  // Validate resources
  if (!('resources' in entry)) {
    errors.push({
      field: `workbooks.${key}.resources`,
      message: `Missing required field: resources in workbook "${key}"`,
    });
  } else if (typeof entry.resources !== 'object' || entry.resources === null || Array.isArray(entry.resources)) {
    errors.push({
      field: `workbooks.${key}.resources`,
      message: `Field "resources" in workbook "${key}" must be a non-null object`,
    });
  } else {
    const resources = entry.resources as Record<string, unknown>;
    for (const [resourceName, entries] of Object.entries(resources)) {
      validateResourceEntries(key, resourceName, entries, errors);
    }
  }
}

/**
 * Validates workbook metadata fields.
 */
function validateMetadata(
  workbookKey: string,
  metadata: unknown,
  errors: ValidationError[]
): void {
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
    errors.push({
      field: `workbooks.${workbookKey}.metadata`,
      message: `Metadata in workbook "${workbookKey}" must be a non-null object`,
    });
    return;
  }

  const meta = metadata as Record<string, unknown>;
  const requiredStringFields: (keyof WorkbookMetadata)[] = [
    'id', 'projectName', 'month', 'fileName', 'origin', 'importedAt',
  ];
  const requiredNumberFields: (keyof WorkbookMetadata)[] = ['year', 'fileSize', 'resourceCount'];

  for (const field of requiredStringFields) {
    if (!(field in meta)) {
      errors.push({
        field: `workbooks.${workbookKey}.metadata.${field}`,
        message: `Missing required field: ${field} in metadata of workbook "${workbookKey}"`,
      });
    } else if (typeof meta[field] !== 'string') {
      errors.push({
        field: `workbooks.${workbookKey}.metadata.${field}`,
        message: `Field "${field}" in metadata of workbook "${workbookKey}" must be a string`,
      });
    }
  }

  for (const field of requiredNumberFields) {
    if (!(field in meta)) {
      errors.push({
        field: `workbooks.${workbookKey}.metadata.${field}`,
        message: `Missing required field: ${field} in metadata of workbook "${workbookKey}"`,
      });
    } else if (typeof meta[field] !== 'number') {
      errors.push({
        field: `workbooks.${workbookKey}.metadata.${field}`,
        message: `Field "${field}" in metadata of workbook "${workbookKey}" must be a number`,
      });
    }
  }

  // Validate origin is valid enum value
  if ('origin' in meta && typeof meta.origin === 'string') {
    if (meta.origin !== 'local' && meta.origin !== 'google-drive') {
      errors.push({
        field: `workbooks.${workbookKey}.metadata.origin`,
        message: `Field "origin" in metadata of workbook "${workbookKey}" must be "local" or "google-drive"`,
      });
    }
  }
}

/**
 * Validates resource timesheet entries array.
 */
function validateResourceEntries(
  workbookKey: string,
  resourceName: string,
  entries: unknown,
  errors: ValidationError[]
): void {
  if (!Array.isArray(entries)) {
    errors.push({
      field: `workbooks.${workbookKey}.resources.${resourceName}`,
      message: `Resource entries for "${resourceName}" in workbook "${workbookKey}" must be an array`,
    });
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    validateTimesheetEntry(workbookKey, resourceName, i, entries[i], errors);
  }
}

/**
 * Validates a single timesheet entry.
 */
function validateTimesheetEntry(
  workbookKey: string,
  resourceName: string,
  index: number,
  entry: unknown,
  errors: ValidationError[]
): void {
  const fieldPath = `workbooks.${workbookKey}.resources.${resourceName}[${index}]`;

  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    errors.push({
      field: fieldPath,
      message: `Entry at index ${index} for resource "${resourceName}" must be a non-null object`,
    });
    return;
  }

  const row = entry as Record<string, unknown>;

  // Validate date - must be ISO 8601 date string
  if (!('date' in row)) {
    errors.push({
      field: `${fieldPath}.date`,
      message: `Missing required field: date`,
    });
  } else if (typeof row.date !== 'string') {
    errors.push({
      field: `${fieldPath}.date`,
      message: `Field "date" must be a string (ISO 8601 format)`,
    });
  } else if (!isValidISO8601Date(row.date)) {
    errors.push({
      field: `${fieldPath}.date`,
      message: `Field "date" must be a valid ISO 8601 date string`,
    });
  }

  // Validate hoursWorked - must be number 0-24
  if (!('hoursWorked' in row)) {
    errors.push({
      field: `${fieldPath}.hoursWorked`,
      message: `Missing required field: hoursWorked`,
    });
  } else if (typeof row.hoursWorked !== 'number') {
    errors.push({
      field: `${fieldPath}.hoursWorked`,
      message: `Field "hoursWorked" must be a number`,
    });
  } else if (row.hoursWorked < 0 || row.hoursWorked > 24) {
    errors.push({
      field: `${fieldPath}.hoursWorked`,
      message: `Field "hoursWorked" must be between 0 and 24`,
    });
  }

  // Validate taskDescription - must be string
  if (!('taskDescription' in row)) {
    errors.push({
      field: `${fieldPath}.taskDescription`,
      message: `Missing required field: taskDescription`,
    });
  } else if (typeof row.taskDescription !== 'string') {
    errors.push({
      field: `${fieldPath}.taskDescription`,
      message: `Field "taskDescription" must be a string`,
    });
  }

  // Validate projectName - must be string
  if (!('projectName' in row)) {
    errors.push({
      field: `${fieldPath}.projectName`,
      message: `Missing required field: projectName`,
    });
  } else if (typeof row.projectName !== 'string') {
    errors.push({
      field: `${fieldPath}.projectName`,
      message: `Field "projectName" must be a string`,
    });
  }

  // Validate sourceDocLink - must be string
  if (!('sourceDocLink' in row)) {
    errors.push({
      field: `${fieldPath}.sourceDocLink`,
      message: `Missing required field: sourceDocLink`,
    });
  } else if (typeof row.sourceDocLink !== 'string') {
    errors.push({
      field: `${fieldPath}.sourceDocLink`,
      message: `Field "sourceDocLink" must be a string`,
    });
  }
}

/**
 * Validates an ISO 8601 date string (YYYY-MM-DD format).
 */
function isValidISO8601Date(value: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }
  const date = new Date(value + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return false;
  }
  // Verify the date components match (handles invalid dates like 2026-02-30)
  const [year, month, day] = value.split('-').map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}
