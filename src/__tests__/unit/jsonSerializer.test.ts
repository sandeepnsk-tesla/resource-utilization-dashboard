/**
 * Unit tests for the JSON Serializer module.
 * Tests serialize and deserialize functions for correctness, error handling,
 * and round-trip data preservation.
 */

import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../../parsers/jsonSerializer';
import type { ParsedWorkbookCollection } from '../../types/parser';

function createValidCollection(): ParsedWorkbookCollection {
  return {
    version: '1.0',
    workbooks: {
      ProjectAlpha_July_2026: {
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          projectName: 'ProjectAlpha',
          month: 'July',
          year: 2026,
          fileName: 'ProjectAlpha_July_2026.xlsx',
          origin: 'local',
          fileSize: 1024,
          importedAt: '2026-07-01T10:00:00Z',
          resourceCount: 2,
        },
        resources: {
          'Alice Smith': [
            {
              date: '2026-07-01',
              taskDescription: 'Worked on feature X',
              hoursWorked: 8,
              projectName: 'ProjectAlpha',
              sourceDocLink: 'https://docs.example.com/feature-x',
            },
            {
              date: '2026-07-02',
              taskDescription: 'Code review',
              hoursWorked: 4,
              projectName: 'ProjectAlpha',
              sourceDocLink: '',
            },
          ],
          'Bob Jones': [
            {
              date: '2026-07-01',
              taskDescription: 'Database migration',
              hoursWorked: 6,
              projectName: 'ProjectAlpha',
              sourceDocLink: 'https://docs.example.com/db',
            },
          ],
        },
      },
    },
  };
}

describe('JSON Serializer', () => {
  describe('serialize', () => {
    it('should serialize a valid collection successfully', () => {
      const data = createValidCollection();
      const result = serialize(data);

      expect(result.success).toBe(true);
      expect(result.json).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should produce valid JSON output', () => {
      const data = createValidCollection();
      const result = serialize(data);

      expect(() => JSON.parse(result.json!)).not.toThrow();
    });

    it('should include version 1.0 in serialized output', () => {
      const data = createValidCollection();
      const result = serialize(data);
      const parsed = JSON.parse(result.json!);

      expect(parsed.version).toBe('1.0');
    });

    it('should preserve workbook-to-project-month key association', () => {
      const data = createValidCollection();
      const result = serialize(data);
      const parsed = JSON.parse(result.json!);

      expect(parsed.workbooks).toHaveProperty('ProjectAlpha_July_2026');
    });

    it('should preserve sheet-to-resource mapping', () => {
      const data = createValidCollection();
      const result = serialize(data);
      const parsed = JSON.parse(result.json!);

      const workbook = parsed.workbooks['ProjectAlpha_July_2026'];
      expect(workbook.resources).toHaveProperty('Alice Smith');
      expect(workbook.resources).toHaveProperty('Bob Jones');
    });

    it('should preserve all metadata fields', () => {
      const data = createValidCollection();
      const result = serialize(data);
      const parsed = JSON.parse(result.json!);

      const metadata = parsed.workbooks['ProjectAlpha_July_2026'].metadata;
      expect(metadata.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(metadata.projectName).toBe('ProjectAlpha');
      expect(metadata.month).toBe('July');
      expect(metadata.year).toBe(2026);
      expect(metadata.fileName).toBe('ProjectAlpha_July_2026.xlsx');
      expect(metadata.origin).toBe('local');
      expect(metadata.fileSize).toBe(1024);
      expect(metadata.importedAt).toBe('2026-07-01T10:00:00Z');
      expect(metadata.resourceCount).toBe(2);
    });

    it('should preserve all timesheet entry fields', () => {
      const data = createValidCollection();
      const result = serialize(data);
      const parsed = JSON.parse(result.json!);

      const entries = parsed.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'];
      expect(entries[0].date).toBe('2026-07-01');
      expect(entries[0].taskDescription).toBe('Worked on feature X');
      expect(entries[0].hoursWorked).toBe(8);
      expect(entries[0].projectName).toBe('ProjectAlpha');
      expect(entries[0].sourceDocLink).toBe('https://docs.example.com/feature-x');
    });

    it('should handle empty workbooks object', () => {
      const data: ParsedWorkbookCollection = {
        version: '1.0',
        workbooks: {},
      };
      const result = serialize(data);

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.json!);
      expect(parsed.version).toBe('1.0');
      expect(parsed.workbooks).toEqual({});
    });

    it('should handle empty resources for a workbook (Req 14.5)', () => {
      const data: ParsedWorkbookCollection = {
        version: '1.0',
        workbooks: {
          ProjectBeta_August_2026: {
            metadata: {
              id: 'abc-123',
              projectName: 'ProjectBeta',
              month: 'August',
              year: 2026,
              fileName: 'ProjectBeta_August_2026.xlsx',
              origin: 'google-drive',
              fileSize: 512,
              importedAt: '2026-08-01T09:00:00Z',
              resourceCount: 0,
            },
            resources: {},
          },
        },
      };
      const result = serialize(data);

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.json!);
      expect(parsed.workbooks['ProjectBeta_August_2026'].metadata.projectName).toBe('ProjectBeta');
      expect(parsed.workbooks['ProjectBeta_August_2026'].resources).toEqual({});
    });
  });

  describe('deserialize', () => {
    it('should deserialize valid JSON successfully', () => {
      const data = createValidCollection();
      const json = JSON.stringify(data);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should produce field-by-field equivalent data on round-trip', () => {
      const data = createValidCollection();
      const serialized = serialize(data);
      const result = deserialize(serialized.json!);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should reject invalid JSON', () => {
      const result = deserialize('not valid json {{{');

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0].field).toBe('root');
    });

    it('should reject non-object root', () => {
      const result = deserialize('"just a string"');

      expect(result.success).toBe(false);
      expect(result.errors![0].field).toBe('root');
    });

    it('should reject array root', () => {
      const result = deserialize('[]');

      expect(result.success).toBe(false);
      expect(result.errors![0].field).toBe('root');
    });

    it('should report missing version field', () => {
      const result = deserialize(JSON.stringify({ workbooks: {} }));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field === 'version')).toBe(true);
    });

    it('should report non-string version field', () => {
      const result = deserialize(JSON.stringify({ version: 123, workbooks: {} }));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field === 'version')).toBe(true);
    });

    it('should report missing workbooks field', () => {
      const result = deserialize(JSON.stringify({ version: '1.0' }));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field === 'workbooks')).toBe(true);
    });

    it('should report non-object workbooks field', () => {
      const result = deserialize(JSON.stringify({ version: '1.0', workbooks: [] }));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field === 'workbooks')).toBe(true);
    });

    it('should report missing metadata in workbook entry', () => {
      const json = JSON.stringify({
        version: '1.0',
        workbooks: {
          TestProject_Jan_2026: {
            resources: {},
          },
        },
      });
      const result = deserialize(json);

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('metadata'))).toBe(true);
    });

    it('should report missing resources in workbook entry', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      delete json.workbooks['ProjectAlpha_July_2026'].resources;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('resources'))).toBe(true);
    });

    it('should report invalid metadata field types', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].metadata.year = 'not-a-number';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('year'))).toBe(true);
    });

    it('should report invalid origin value', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].metadata.origin = 'invalid-origin';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('origin'))).toBe(true);
    });

    it('should report non-array resource entries', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'] = 'not-an-array';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('Alice Smith'))).toBe(true);
    });

    it('should report invalid date in timesheet entry', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].date = 'invalid-date';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('date'))).toBe(true);
    });

    it('should report non-numeric hoursWorked', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].hoursWorked = 'eight';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('hoursWorked'))).toBe(true);
    });

    it('should report hoursWorked out of range (> 24)', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].hoursWorked = 25;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('hoursWorked'))).toBe(true);
    });

    it('should report hoursWorked out of range (< 0)', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].hoursWorked = -1;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('hoursWorked'))).toBe(true);
    });

    it('should report missing taskDescription', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      delete json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].taskDescription;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('taskDescription'))).toBe(true);
    });

    it('should report missing projectName in entry', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      delete json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].projectName;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('projectName'))).toBe(true);
    });

    it('should report missing sourceDocLink', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      delete json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].sourceDocLink;

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('sourceDocLink'))).toBe(true);
    });

    it('should accept empty workbooks object', () => {
      const json = JSON.stringify({ version: '1.0', workbooks: {} });
      const result = deserialize(json);

      expect(result.success).toBe(true);
      expect(result.data!.workbooks).toEqual({});
    });

    it('should accept empty resources for a workbook (metadata preserved)', () => {
      const data: ParsedWorkbookCollection = {
        version: '1.0',
        workbooks: {
          ProjectX_March_2026: {
            metadata: {
              id: 'xyz-789',
              projectName: 'ProjectX',
              month: 'March',
              year: 2026,
              fileName: 'ProjectX_March_2026.xlsx',
              origin: 'local',
              fileSize: 256,
              importedAt: '2026-03-01T08:00:00Z',
              resourceCount: 0,
            },
            resources: {},
          },
        },
      };
      const json = JSON.stringify(data);
      const result = deserialize(json);

      expect(result.success).toBe(true);
      expect(result.data!.workbooks['ProjectX_March_2026'].metadata.projectName).toBe('ProjectX');
      expect(result.data!.workbooks['ProjectX_March_2026'].resources).toEqual({});
    });

    it('should report multiple validation errors at once', () => {
      const json = JSON.stringify({
        workbooks: 'invalid',
      });
      const result = deserialize(json);

      expect(result.success).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(1);
    });

    it('should reject invalid date like 2026-02-30', () => {
      const data = createValidCollection();
      const json = JSON.parse(JSON.stringify(data));
      json.workbooks['ProjectAlpha_July_2026'].resources['Alice Smith'][0].date = '2026-02-30';

      const result = deserialize(JSON.stringify(json));

      expect(result.success).toBe(false);
      expect(result.errors!.some(e => e.field.includes('date'))).toBe(true);
    });
  });
});
