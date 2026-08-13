/**
 * Unit tests for the Excel Parser Core module.
 */

import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../../parsers/excelParserCore';

/**
 * Helper: Creates a valid Excel workbook as ArrayBuffer with given sheet data.
 */
function createWorkbook(
  sheets: Record<string, unknown[][]>,
  fileName?: string
): { buffer: ArrayBuffer; file: File } {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  // XLSX.write with type 'array' returns an ArrayBuffer directly
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const file = new File([buffer], fileName || 'TestProject_July_2026.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return { buffer, file };
}

describe('parseWorkbook', () => {
  it('should parse a valid workbook with conforming sheets', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task A', 8, 'ProjectAlpha', 'https://example.com/doc1'],
      ['2026-07-02', 'Task B', 6, 'ProjectAlpha', 'https://example.com/doc2'],
    ];

    const { file } = createWorkbook({ 'John Doe': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets).toHaveLength(1);
    expect(result.timesheets[0].resourceName).toBe('John Doe');
    expect(result.timesheets[0].entries).toHaveLength(2);
    expect(result.timesheets[0].entries[0].date).toBe('2026-07-01');
    expect(result.timesheets[0].entries[0].hoursWorked).toBe(8);
    expect(result.timesheets[0].entries[0].taskDescription).toBe('Task A');
    expect(result.errors).toHaveLength(0);
  });

  it('should return FILE_TOO_LARGE error when file exceeds size limit', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task A', 8, 'ProjectAlpha', ''],
    ];
    const { file } = createWorkbook({ 'Sheet1': sheetData });

    // Set a very small max file size to trigger the error
    const result = await parseWorkbook(file, { maxFileSizeMB: 0.0001 });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe('FILE_TOO_LARGE');
  });

  it('should return an error for non-Excel data (NO_VALID_DATA or INVALID_FORMAT)', async () => {
    // Note: SheetJS is very lenient and rarely throws for garbage data.
    // It will parse nearly anything into an empty/useless workbook.
    // The result will typically be NO_VALID_DATA since the sheets won't have valid headers.
    const invalidData = new ArrayBuffer(100);
    const file = new File([invalidData], 'invalid.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await parseWorkbook(file);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.some((e) => e.code === 'INVALID_FORMAT' || e.code === 'NO_VALID_DATA')
    ).toBe(true);
  });

  it('should skip non-conforming sheets and collect warnings', async () => {
    const validSheet = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task A', 8, 'ProjectAlpha', ''],
    ];
    const invalidSheet = [
      ['Date', 'Description', 'Hours'],  // Missing required columns
      ['2026-07-01', 'Task B', 5],
    ];

    const { file } = createWorkbook({
      'ValidResource': validSheet,
      'InvalidSheet': invalidSheet,
    });

    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets).toHaveLength(1);
    expect(result.timesheets[0].resourceName).toBe('ValidResource');
    expect(result.warnings.some((w) => w.type === 'skipped_sheet' && w.sheetName === 'InvalidSheet')).toBe(true);
  });

  it('should return NO_VALID_DATA when all sheets are non-conforming', async () => {
    const invalidSheet = [
      ['Date', 'Description', 'Hours'],  // Missing required columns
      ['2026-07-01', 'Task B', 5],
    ];

    const { file } = createWorkbook({ 'Sheet1': invalidSheet });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.code === 'NO_VALID_DATA')).toBe(true);
  });

  it('should skip rows with invalid dates and collect warnings', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Valid row', 8, 'Project', ''],
      ['not-a-date', 'Invalid date', 4, 'Project', ''],   // Invalid date
      ['', 'Empty date', 6, 'Project', ''],                 // Empty date
      ['2026-07-03', 'Another valid', 3, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets[0].entries).toHaveLength(2);
    expect(result.warnings.some((w) => w.type === 'skipped_rows')).toBe(true);
  });

  it('should skip rows with non-numeric hours and collect warnings', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Valid', 8, 'Project', ''],
      ['2026-07-02', 'Invalid hours', 'abc', 'Project', ''],  // Non-numeric
      ['2026-07-03', 'Empty hours', '', 'Project', ''],        // Empty
      ['2026-07-04', 'Valid', 5, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets[0].entries).toHaveLength(2);
    expect(result.timesheets[0].entries[0].hoursWorked).toBe(8);
    expect(result.timesheets[0].entries[1].hoursWorked).toBe(5);
  });

  it('should clamp hours to 0-24 range', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Negative', -5, 'Project', ''],
      ['2026-07-02', 'Overflow', 30, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets[0].entries[0].hoursWorked).toBe(0);
    expect(result.timesheets[0].entries[1].hoursWorked).toBe(24);
  });

  it('should truncate task descriptions to 500 characters', async () => {
    const longDesc = 'A'.repeat(600);
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', longDesc, 8, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets[0].entries[0].taskDescription).toHaveLength(500);
  });

  it('should trim resource name from sheet name', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task', 8, 'Project', ''],
    ];

    // Note: XLSX library trims sheet names by default, but our code explicitly trims
    const { file } = createWorkbook({ 'Resource Name': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets[0].resourceName).toBe('Resource Name');
  });

  it('should use parseFilename to extract project metadata', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task', 8, 'ProjectAlpha', ''],
    ];

    const { buffer } = createWorkbook({ 'Resource1': sheetData });
    const file = new File([buffer], 'ProjectAlpha_July_2026.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.workbookMetadata.projectName).toBe('ProjectAlpha');
    expect(result.workbookMetadata.month).toBe('July');
    expect(result.workbookMetadata.year).toBe(2026);
  });

  it('should use defaults when filename does not match convention', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task', 8, 'ProjectAlpha', ''],
    ];

    const { buffer } = createWorkbook({ 'Resource1': sheetData });
    const file = new File([buffer], 'random_file_name.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.workbookMetadata.projectName).toBe('Unknown Project');
    expect(result.workbookMetadata.month).toBe('Unknown');
  });

  it('should handle case-insensitive column header matching', async () => {
    const sheetData = [
      ['DATE', 'task description', 'HOURS WORKED', 'project name', 'SOURCE DOCUMENT LINK'],
      ['2026-07-01', 'Task', 8, 'Project', 'https://example.com'],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets).toHaveLength(1);
    expect(result.timesheets[0].entries).toHaveLength(1);
  });

  it('should handle multiple conforming sheets', async () => {
    const sheet1 = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task A', 8, 'Project', ''],
    ];
    const sheet2 = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task B', 6, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Alice': sheet1, 'Bob': sheet2 });
    const result = await parseWorkbook(file);

    expect(result.success).toBe(true);
    expect(result.timesheets).toHaveLength(2);
    expect(result.workbookMetadata.resourceCount).toBe(2);
  });

  it('should generate a valid UUID for workbook id', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task', 8, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.workbookMetadata.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('should set origin to local for File inputs', async () => {
    const sheetData = [
      ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
      ['2026-07-01', 'Task', 8, 'Project', ''],
    ];

    const { file } = createWorkbook({ 'Resource1': sheetData });
    const result = await parseWorkbook(file);

    expect(result.workbookMetadata.origin).toBe('local');
  });

  describe('alternative column format support', () => {
    it('should parse sheets with alternative column headers (No. of Hours, Tasks)', async () => {
      const sheetData = [
        ['Date', 'Weekday', 'No. of Hours', 'Tasks'],
        ['1-Jul-2026', 'Wed', 1, 'Review translation approaches'],
        ['2-Jul-2026', 'Thu', 2, 'Customer daily syncup'],
      ];

      const { file } = createWorkbook({ 'Sandeep': sheetData }, 'Timesheet.xlsx');
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].resourceName).toBe('Sandeep');
      expect(result.timesheets[0].entries).toHaveLength(2);
      expect(result.timesheets[0].entries[0].hoursWorked).toBe(1);
      expect(result.timesheets[0].entries[0].taskDescription).toBe('Review translation approaches');
      expect(result.timesheets[0].entries[1].hoursWorked).toBe(2);
      expect(result.timesheets[0].entries[1].taskDescription).toBe('Customer daily syncup');
      // Project name and source doc link default to empty when columns missing
      expect(result.timesheets[0].entries[0].projectName).toBe('');
      expect(result.timesheets[0].entries[0].sourceDocLink).toBe('');
    });

    it('should skip consolidated/summary sheets', async () => {
      const summarySheet = [
        ['##', 'Team Member', 'July 2026', 'August 2026'],
        [],
        ['1', 'Sandeep', '32'],
      ];
      const resourceSheet = [
        ['Date', 'Weekday', 'No. of Hours', 'Tasks'],
        ['1-Jul-2026', 'Wed', 8, 'Task A'],
      ];

      const { file } = createWorkbook({
        'Consolidated KLI': summarySheet,
        'Sandeep': resourceSheet,
      }, 'Timesheet.xlsx');
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].resourceName).toBe('Sandeep');
      expect(result.warnings.some((w) =>
        w.type === 'skipped_sheet' && w.sheetName === 'Consolidated KLI'
      )).toBe(true);
    });

    it('should handle multiple resource sheets with alternative format', async () => {
      const sheet1 = [
        ['Date', 'Weekday', 'No. of Hours', 'Tasks'],
        ['1-Jul-2026', 'Wed', 8, 'Development work'],
      ];
      const sheet2 = [
        ['Date', 'Weekday', 'No. of Hours', 'Tasks'],
        ['1-Jul-2026', 'Wed', 6, 'Testing'],
      ];

      const { file } = createWorkbook({
        'Consolidated KLI': [['##', 'Team Member'], ['1', 'Arun']],
        'Arun': sheet1,
        'Prarthana': sheet2,
      }, 'Timesheet.xlsx');
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets).toHaveLength(2);
      expect(result.timesheets[0].resourceName).toBe('Arun');
      expect(result.timesheets[1].resourceName).toBe('Prarthana');
    });

    it('should work with only Date and No. of Hours columns (minimum required)', async () => {
      const sheetData = [
        ['Date', 'No. of Hours'],
        ['1-Jul-2026', 4],
        ['2-Jul-2026', 6],
      ];

      const { file } = createWorkbook({ 'Murari': sheetData }, 'Timesheet.xlsx');
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets).toHaveLength(1);
      expect(result.timesheets[0].entries).toHaveLength(2);
      expect(result.timesheets[0].entries[0].hoursWorked).toBe(4);
      expect(result.timesheets[0].entries[0].taskDescription).toBe('');
      expect(result.timesheets[0].entries[0].projectName).toBe('');
    });

    it('should still parse the original 5-column format correctly', async () => {
      const sheetData = [
        ['Date', 'Task Description', 'Hours Worked', 'Project Name', 'Source Document Link'],
        ['2026-07-01', 'Task A', 8, 'ProjectAlpha', 'https://example.com/doc1'],
      ];

      const { file } = createWorkbook({ 'Resource1': sheetData }, 'ProjectAlpha_July_2026.xlsx');
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets[0].entries[0].taskDescription).toBe('Task A');
      expect(result.timesheets[0].entries[0].projectName).toBe('ProjectAlpha');
      expect(result.timesheets[0].entries[0].sourceDocLink).toBe('https://example.com/doc1');
    });

    it('should skip sheets with "Summary" in the name', async () => {
      const summarySheet = [
        ['Resource', 'Total Hours'],
        ['Alice', 160],
      ];
      const validSheet = [
        ['Date', 'Hours Worked'],
        ['2026-07-01', 8],
      ];

      const { file } = createWorkbook({
        'Monthly Summary': summarySheet,
        'Alice': validSheet,
      });
      const result = await parseWorkbook(file);

      expect(result.success).toBe(true);
      expect(result.timesheets).toHaveLength(1);
      expect(result.warnings.some((w) =>
        w.sheetName === 'Monthly Summary' && w.type === 'skipped_sheet'
      )).toBe(true);
    });
  });
});
