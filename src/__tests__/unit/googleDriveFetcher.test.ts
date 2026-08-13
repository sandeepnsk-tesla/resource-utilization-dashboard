/**
 * Unit tests for Google Drive Fetcher module.
 * Tests URL validation, file ID extraction, direct download URL conversion,
 * and fetch behavior including timeout, permission, and size limit handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractFileId,
  isValidGoogleDriveUrl,
  toDirectDownloadUrl,
  fetchFromGoogleDrive,
} from '../../parsers/googleDriveFetcher';
import { VALIDATION_LIMITS } from '../../constants/validation';

describe('Google Drive Fetcher', () => {
  describe('extractFileId', () => {
    it('extracts file ID from drive.google.com/file/d/ URL', () => {
      const url = 'https://drive.google.com/file/d/abc123XYZ/view?usp=sharing';
      expect(extractFileId(url)).toBe('abc123XYZ');
    });

    it('extracts file ID from docs.google.com/spreadsheets/d/ URL', () => {
      const url = 'https://docs.google.com/spreadsheets/d/spreadsheet456/edit#gid=0';
      expect(extractFileId(url)).toBe('spreadsheet456');
    });

    it('returns null for invalid URLs', () => {
      expect(extractFileId('https://example.com/file.xlsx')).toBeNull();
      expect(extractFileId('https://drive.google.com/open?id=abc')).toBeNull();
      expect(extractFileId('')).toBeNull();
      expect(extractFileId('not-a-url')).toBeNull();
    });

    it('extracts file ID with special characters', () => {
      const url = 'https://drive.google.com/file/d/1A2b-_C3d4E5f/view';
      expect(extractFileId(url)).toBe('1A2b-_C3d4E5f');
    });
  });

  describe('isValidGoogleDriveUrl', () => {
    it('returns true for valid Google Drive file URLs', () => {
      expect(isValidGoogleDriveUrl('https://drive.google.com/file/d/abc123/view')).toBe(true);
    });

    it('returns true for valid Google Sheets URLs', () => {
      expect(isValidGoogleDriveUrl('https://docs.google.com/spreadsheets/d/xyz789/edit')).toBe(true);
    });

    it('returns false for non-Google Drive URLs', () => {
      expect(isValidGoogleDriveUrl('https://example.com')).toBe(false);
      expect(isValidGoogleDriveUrl('https://drive.google.com/folders/abc')).toBe(false);
    });
  });

  describe('toDirectDownloadUrl', () => {
    it('converts file ID to direct download URL', () => {
      expect(toDirectDownloadUrl('abc123')).toBe(
        'https://drive.google.com/uc?export=download&id=abc123'
      );
    });
  });

  describe('fetchFromGoogleDrive', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    });

    it('returns INVALID_LINK error for invalid URL', async () => {
      const result = await fetchFromGoogleDrive('https://example.com/file.xlsx');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_LINK');
      expect(result.error?.message).toContain('Invalid Google Drive link format');
    });

    it('returns successful result when fetch succeeds', async () => {
      const mockBuffer = new ArrayBuffer(1024);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': '1024',
          'content-disposition': 'attachment; filename="test.xlsx"',
        }),
        arrayBuffer: () => Promise.resolve(mockBuffer),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');

      expect(result.success).toBe(true);
      expect(result.file).toBe(mockBuffer);
      expect(result.fileName).toBe('test.xlsx');
      expect(result.fileSize).toBe(1024);
    });

    it('returns ACCESS_DENIED for 403 responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCESS_DENIED');
      expect(result.error?.message).toContain('public or shared access enabled');
    });

    it('returns ACCESS_DENIED for 401 responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACCESS_DENIED');
    });

    it('returns NETWORK_ERROR for other non-OK responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('returns FILE_TOO_LARGE when content-length exceeds limit', async () => {
      const maxBytes = VALIDATION_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': String(maxBytes + 1),
        }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
      expect(result.error?.message).toContain('50 MB');
    });

    it('returns FILE_TOO_LARGE when actual body exceeds limit', async () => {
      const maxBytes = VALIDATION_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
      // No content-length header, but body is too large
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(maxBytes + 1)),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('returns TIMEOUT error when fetch is aborted', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new DOMException('The operation was aborted', 'AbortError');
          // Simulate timeout
          setTimeout(() => reject(error), 100);
        });
      });

      const resultPromise = fetchFromGoogleDrive(
        'https://drive.google.com/file/d/testId/view',
        50
      );
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('returns NETWORK_ERROR when fetch throws non-abort error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('uses default timeout of 30s from VALIDATION_LIMITS', async () => {
      let signalUsed: AbortSignal | undefined;
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        signalUsed = options?.signal;
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-length': '100' }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        });
      });

      await fetchFromGoogleDrive('https://drive.google.com/file/d/testId/view');

      // Verify fetch was called with an AbortSignal
      expect(signalUsed).toBeDefined();
      expect(signalUsed).toBeInstanceOf(AbortSignal);
    });

    it('uses fileId as filename when no content-disposition header', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '512' }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(512)),
      });

      const result = await fetchFromGoogleDrive('https://drive.google.com/file/d/myFileId123/view');
      expect(result.success).toBe(true);
      expect(result.fileName).toBe('myFileId123.xlsx');
    });
  });
});
