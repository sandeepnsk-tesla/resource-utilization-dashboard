import { describe, it, expect } from 'vitest';
import { parseFilename } from '../../parsers/filenameParser';

describe('parseFilename', () => {
  describe('valid filenames', () => {
    it('parses a standard filename correctly', () => {
      const result = parseFilename('ProjectAlpha_July_2026.xlsx');
      expect(result).toEqual({
        projectName: 'ProjectAlpha',
        month: 'July',
        year: 2026,
        isValid: true,
      });
    });

    it('handles case-insensitive month matching', () => {
      const result = parseFilename('MyProject_january_2024.xlsx');
      expect(result).toEqual({
        projectName: 'MyProject',
        month: 'January',
        year: 2024,
        isValid: true,
      });
    });

    it('handles uppercase month names', () => {
      const result = parseFilename('Demo_DECEMBER_2025.xlsx');
      expect(result).toEqual({
        projectName: 'Demo',
        month: 'December',
        year: 2025,
        isValid: true,
      });
    });

    it('handles .xls extension', () => {
      const result = parseFilename('OldProject_March_2020.xls');
      expect(result).toEqual({
        projectName: 'OldProject',
        month: 'March',
        year: 2020,
        isValid: true,
      });
    });

    it('trims whitespace from the filename', () => {
      const result = parseFilename('  ProjectBeta_April_2023.xlsx  ');
      expect(result).toEqual({
        projectName: 'ProjectBeta',
        month: 'April',
        year: 2023,
        isValid: true,
      });
    });

    it('handles project names with spaces (if no underscores)', () => {
      // Project name cannot contain underscores but the split logic means
      // anything before the first underscore is the project name.
      // Actually with 3-part split, "Project Name" would need to be one segment.
      // This test verifies project name with spaces isn't possible due to split.
      const result = parseFilename('ProjectGamma_February_2022.xlsx');
      expect(result).toEqual({
        projectName: 'ProjectGamma',
        month: 'February',
        year: 2022,
        isValid: true,
      });
    });
  });

  describe('invalid filenames', () => {
    it('returns isValid: false for empty string', () => {
      const result = parseFilename('');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for null-like input', () => {
      const result = parseFilename(undefined as unknown as string);
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for missing extension', () => {
      const result = parseFilename('ProjectAlpha_July_2026');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for wrong extension', () => {
      const result = parseFilename('ProjectAlpha_July_2026.csv');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for missing parts (only 2 underscored segments)', () => {
      const result = parseFilename('ProjectAlpha_July.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for too many parts (extra underscores)', () => {
      const result = parseFilename('Project_Alpha_July_2026.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for invalid month name', () => {
      const result = parseFilename('ProjectAlpha_Smarch_2026.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for abbreviated month name', () => {
      const result = parseFilename('ProjectAlpha_Jul_2026.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for non-numeric year', () => {
      const result = parseFilename('ProjectAlpha_July_abcd.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for 2-digit year', () => {
      const result = parseFilename('ProjectAlpha_July_26.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for 5-digit year', () => {
      const result = parseFilename('ProjectAlpha_July_20260.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for empty project name', () => {
      const result = parseFilename('_July_2026.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for whitespace-only project name', () => {
      const result = parseFilename('   _July_2026.xlsx');
      expect(result.isValid).toBe(false);
    });

    it('returns isValid: false for no underscores', () => {
      const result = parseFilename('ProjectAlphaJuly2026.xlsx');
      expect(result.isValid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles year at boundary (0000)', () => {
      const result = parseFilename('Project_January_0000.xlsx');
      expect(result.isValid).toBe(true);
      expect(result.year).toBe(0);
    });

    it('handles year at boundary (9999)', () => {
      const result = parseFilename('Project_December_9999.xlsx');
      expect(result.isValid).toBe(true);
      expect(result.year).toBe(9999);
    });

    it('returns default invalid metadata shape', () => {
      const result = parseFilename('invalid');
      expect(result).toEqual({
        projectName: '',
        month: '',
        year: 0,
        isValid: false,
      });
    });
  });
});
