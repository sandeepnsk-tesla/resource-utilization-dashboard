/**
 * Integration test: Import the ICICI Lombard file and verify parsing.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseWorkbook } from '../../parsers/excelParserCore';

describe('ICICI Lombard File Import', () => {
  const filePath = path.resolve(
    __dirname,
    '../../../DatsSources',
    'ICICI_Lombard_Timesheet_08_2026.xlsx'
  );

  it('should successfully parse the ICICI timesheet file', async () => {
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File(
      [fileBuffer],
      'ICICI_Lombard_Timesheet_08_2026.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    const result = await parseWorkbook(file);

    console.log('=== ICICI PARSE RESULT ===');
    console.log('Success:', result.success);
    console.log('Errors:', result.errors);
    console.log('Warnings:', result.warnings.map(w => `${w.sheetName}: ${w.message}`));
    console.log('Resource Count:', result.workbookMetadata.resourceCount);
    console.log('');
    console.log('=== RESOURCES ===');
    for (const ts of result.timesheets) {
      const totalHours = ts.entries.reduce((s, e) => s + e.hoursWorked, 0);
      console.log(`  ${ts.resourceName}: ${ts.entries.length} entries, ${totalHours}h`);
    }

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    // Should have 9 resource sheets (All is skipped)
    expect(result.timesheets.length).toBe(9);

    const resourceNames = result.timesheets.map(ts => ts.resourceName).sort();
    expect(resourceNames).toContain('Satyam');
    expect(resourceNames).toContain('Rahul');
    expect(resourceNames).toContain('Sandeep');
  });
});
