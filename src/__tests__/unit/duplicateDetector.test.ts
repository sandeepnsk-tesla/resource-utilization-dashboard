import { describe, it, expect } from 'vitest';
import { detectDuplicate } from '../../logic/duplicateDetector';
import type { DuplicateConflict } from '../../logic/duplicateDetector';
import type { WorkbookMetadata } from '../../types/index';

function createWorkbook(overrides: Partial<WorkbookMetadata> = {}): WorkbookMetadata {
  return {
    id: 'wb-001',
    projectName: 'ProjectAlpha',
    month: 'July',
    year: 2026,
    fileName: 'ProjectAlpha_July_2026.xlsx',
    origin: 'local',
    fileSize: 1024,
    importedAt: '2026-07-01T10:00:00Z',
    resourceCount: 5,
    ...overrides,
  };
}

describe('detectDuplicate', () => {
  it('returns null when existingWorkbooks is empty', () => {
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      []
    );
    expect(result).toBeNull();
  });

  it('returns null when no duplicate exists', () => {
    const existing = [
      createWorkbook({ id: 'wb-001', projectName: 'ProjectBeta', month: 'July', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).toBeNull();
  });

  it('detects exact match of project name, month, and year', () => {
    const existing = [
      createWorkbook({ id: 'wb-001', projectName: 'ProjectAlpha', month: 'July', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).not.toBeNull();
    expect(result!.existingWorkbookId).toBe('wb-001');
    expect(result!.projectName).toBe('ProjectAlpha');
    expect(result!.month).toBe('July');
    expect(result!.year).toBe(2026);
  });

  it('detects duplicate with case-insensitive project name comparison', () => {
    const existing = [
      createWorkbook({ id: 'wb-002', projectName: 'ProjectAlpha', month: 'July', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'projectalpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).not.toBeNull();
    expect(result!.existingWorkbookId).toBe('wb-002');
  });

  it('detects duplicate with mixed case project name', () => {
    const existing = [
      createWorkbook({ id: 'wb-003', projectName: 'PROJECTALPHA', month: 'July', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).not.toBeNull();
    expect(result!.existingWorkbookId).toBe('wb-003');
  });

  it('detects duplicate with case-insensitive month comparison', () => {
    const existing = [
      createWorkbook({ id: 'wb-004', projectName: 'ProjectAlpha', month: 'JULY', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'july', year: 2026 },
      existing
    );
    expect(result).not.toBeNull();
    expect(result!.existingWorkbookId).toBe('wb-004');
  });

  it('returns null when project name matches but month differs', () => {
    const existing = [
      createWorkbook({ id: 'wb-005', projectName: 'ProjectAlpha', month: 'August', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).toBeNull();
  });

  it('returns null when project name matches but year differs', () => {
    const existing = [
      createWorkbook({ id: 'wb-006', projectName: 'ProjectAlpha', month: 'July', year: 2025 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).toBeNull();
  });

  it('returns null when month and year match but project name differs', () => {
    const existing = [
      createWorkbook({ id: 'wb-007', projectName: 'ProjectBeta', month: 'July', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).toBeNull();
  });

  it('returns the first matching duplicate when multiple workbooks exist', () => {
    const existing = [
      createWorkbook({ id: 'wb-008', projectName: 'ProjectBeta', month: 'July', year: 2026 }),
      createWorkbook({ id: 'wb-009', projectName: 'ProjectAlpha', month: 'July', year: 2026 }),
      createWorkbook({ id: 'wb-010', projectName: 'ProjectAlpha', month: 'August', year: 2026 }),
    ];
    const result = detectDuplicate(
      { projectName: 'ProjectAlpha', month: 'July', year: 2026 },
      existing
    );
    expect(result).not.toBeNull();
    expect(result!.existingWorkbookId).toBe('wb-009');
  });

  it('returns conflict info preserving the existing workbook fields', () => {
    const existing = [
      createWorkbook({ id: 'wb-011', projectName: 'My Project', month: 'December', year: 2025 }),
    ];
    const result = detectDuplicate(
      { projectName: 'my project', month: 'december', year: 2025 },
      existing
    );
    expect(result).toEqual({
      existingWorkbookId: 'wb-011',
      projectName: 'My Project',
      month: 'December',
      year: 2025,
    } satisfies DuplicateConflict);
  });
});
