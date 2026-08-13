/**
 * Integration test: Import the actual user file and verify the full parsing flow.
 * Uses the real Excel file from DatsSources folder.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseWorkbook } from '../../parsers/excelParserCore';

describe('Real File Import Flow', () => {
  const filePath = path.resolve(
    __dirname,
    '../../../DatsSources',
    "Kotak Life Insurance _ Prod - Voice Assistance _ July'26 Timesheet_Updated.xlsx"
  );

  it('should successfully parse the actual timesheet file', async () => {
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File(
      [fileBuffer],
      "Kotak Life Insurance _ Prod - Voice Assistance _ July'26 Timesheet_Updated.xlsx",
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    const result = await parseWorkbook(file);

    console.log('=== PARSE RESULT ===');
    console.log('Success:', result.success);
    console.log('Errors:', result.errors);
    console.log('Warnings:', result.warnings.map(w => `${w.sheetName}: ${w.message}`));
    console.log('');
    console.log('=== METADATA ===');
    console.log('Project:', result.workbookMetadata.projectName);
    console.log('Month:', result.workbookMetadata.month);
    console.log('Year:', result.workbookMetadata.year);
    console.log('Resource Count:', result.workbookMetadata.resourceCount);
    console.log('File Size:', result.workbookMetadata.fileSize, 'bytes');
    console.log('');
    console.log('=== RESOURCES ===');
    for (const ts of result.timesheets) {
      console.log(`  ${ts.resourceName}: ${ts.entries.length} entries, total hours: ${ts.entries.reduce((s, e) => s + e.hoursWorked, 0)}`);
      if (ts.entries.length > 0) {
        console.log(`    First entry: ${ts.entries[0].date} - ${ts.entries[0].hoursWorked}h - "${ts.entries[0].taskDescription.substring(0, 60)}..."`);
      }
    }

    // Assertions
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);

    // Should have 5 resource sheets (Sandeep, Arun, Rasik, Murari, Prarthana)
    expect(result.timesheets.length).toBe(5);

    // Should have skipped the "Consolidated KLI" sheet
    expect(result.warnings.some(w => 
      w.sheetName === 'Consolidated KLI' && w.type === 'skipped_sheet'
    )).toBe(true);

    // Verify resource names
    const resourceNames = result.timesheets.map(ts => ts.resourceName).sort();
    expect(resourceNames).toEqual(['Arun', 'Murari', 'Prarthana', 'Rasik', 'Sandeep']);

    // Verify each resource has entries
    for (const ts of result.timesheets) {
      expect(ts.entries.length).toBeGreaterThan(0);
    }

    // Verify metadata defaults (filename doesn't match convention)
    expect(result.workbookMetadata.projectName).toBe('Unknown Project');
    expect(result.workbookMetadata.origin).toBe('local');
    expect(result.workbookMetadata.resourceCount).toBe(5);

    // Verify entry structure
    const firstEntry = result.timesheets[0].entries[0];
    expect(firstEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // ISO 8601
    expect(firstEntry.hoursWorked).toBeGreaterThanOrEqual(0);
    expect(firstEntry.hoursWorked).toBeLessThanOrEqual(24);
    expect(typeof firstEntry.taskDescription).toBe('string');
    expect(typeof firstEntry.projectName).toBe('string');
    expect(typeof firstEntry.sourceDocLink).toBe('string');
  });

  it('should extract correct total hours per resource', async () => {
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File(
      [fileBuffer],
      "Kotak Life Insurance _ Prod - Voice Assistance _ July'26 Timesheet_Updated.xlsx",
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    const result = await parseWorkbook(file);
    expect(result.success).toBe(true);

    // Log totals for verification
    const totals: Record<string, number> = {};
    for (const ts of result.timesheets) {
      totals[ts.resourceName] = ts.entries.reduce((sum, e) => sum + e.hoursWorked, 0);
    }
    console.log('\n=== HOURS PER RESOURCE ===');
    for (const [name, hours] of Object.entries(totals)) {
      console.log(`  ${name}: ${hours} hours`);
    }

    // All resources should have positive total hours
    for (const ts of result.timesheets) {
      const total = ts.entries.reduce((sum, e) => sum + e.hoursWorked, 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});
