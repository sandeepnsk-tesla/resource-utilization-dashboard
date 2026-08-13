/**
 * Google Drive Fetcher Module
 *
 * Downloads Excel files from Google Drive/Sheets sharing links.
 * Handles CORS by using the Google Sheets export API for spreadsheets
 * and a CORS-friendly approach for Drive files.
 *
 * Supports:
 * - Google Sheets links (docs.google.com/spreadsheets/d/{id}) → export as xlsx
 * - Google Drive file links (drive.google.com/file/d/{id}) → direct download via proxy
 */

import type { FetchResult } from '../types/parser';
import { GOOGLE_DRIVE_PATTERNS, VALIDATION_LIMITS } from '../constants/validation';

/**
 * Extracts the file ID from a valid Google Drive/Sheets URL.
 * Returns null if the URL does not match any accepted pattern.
 */
export function extractFileId(url: string): string | null {
  for (const pattern of GOOGLE_DRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Validates whether a URL matches one of the accepted Google Drive/Sheets patterns.
 */
export function isValidGoogleDriveUrl(url: string): boolean {
  return extractFileId(url) !== null;
}

/**
 * Determines if the URL is a Google Sheets link (vs a Drive file link).
 */
export function isGoogleSheetsUrl(url: string): boolean {
  return url.includes('docs.google.com/spreadsheets/');
}

/**
 * Converts a Google Sheets link to an xlsx export URL.
 * This format is CORS-friendly for publicly shared sheets.
 */
export function toSheetsExportUrl(fileId: string): string {
  return `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
}

/**
 * Converts a Google Drive file link to a direct download URL.
 */
export function toDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Builds the best download URL based on the link type.
 * - Google Sheets → export as xlsx (CORS-friendly)
 * - Drive files → direct download URL
 */
export function buildDownloadUrl(url: string, fileId: string): string {
  if (isGoogleSheetsUrl(url)) {
    return toSheetsExportUrl(fileId);
  }
  return toDirectDownloadUrl(fileId);
}

/**
 * Fetches an Excel file from a Google Drive/Sheets sharing link.
 *
 * For Google Sheets links, uses the /export?format=xlsx endpoint which
 * is CORS-friendly for publicly shared sheets.
 *
 * For Drive file links, attempts direct download.
 *
 * @param url - A Google Drive/Sheets sharing URL
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns FetchResult with the downloaded file or error details
 */
export async function fetchFromGoogleDrive(
  url: string,
  timeoutMs: number = VALIDATION_LIMITS.GOOGLE_DRIVE_TIMEOUT_MS
): Promise<FetchResult> {
  // Validate URL pattern
  const fileId = extractFileId(url);
  if (!fileId) {
    return {
      success: false,
      error: {
        code: 'INVALID_LINK',
        message: 'Invalid Google Drive link format. Please provide a valid sharing link',
      },
    };
  }

  // Build the appropriate download URL
  const downloadUrl = buildDownloadUrl(url, fileId);

  // Set up AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(downloadUrl, {
      signal: controller.signal,
      // For Google Sheets export, we need to follow redirects
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Handle CORS errors — they usually manifest as opaque responses or TypeError
    // Handle permission/access errors (403 Forbidden, 401 Unauthorized)
    if (response.status === 403 || response.status === 401) {
      return {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message:
            'File could not be retrieved. Please verify the link has public or shared access enabled (Anyone with the link → Viewer)',
        },
      };
    }

    // Handle other non-OK responses
    if (!response.ok) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message:
            `Download failed (HTTP ${response.status}). Please check your connection and verify the file is publicly shared.`,
        },
      };
    }

    // Check Content-Length header for file size limit before downloading body
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const sizeBytes = parseInt(contentLength, 10);
      const maxSizeBytes = VALIDATION_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
      if (sizeBytes > maxSizeBytes) {
        return {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Maximum supported file size is ${VALIDATION_LIMITS.MAX_FILE_SIZE_MB} MB`,
          },
        };
      }
    }

    // Read response body as ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Check actual downloaded size against limit
    const maxSizeBytes = VALIDATION_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (arrayBuffer.byteLength > maxSizeBytes) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `Maximum supported file size is ${VALIDATION_LIMITS.MAX_FILE_SIZE_MB} MB`,
        },
      };
    }

    // Verify we got actual file content (not an HTML error page)
    // Google sometimes returns an HTML page for permission errors
    if (arrayBuffer.byteLength < 100) {
      return {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'File could not be retrieved. The response was too small — please verify sharing permissions.',
        },
      };
    }

    // Check if response is HTML (error page) instead of xlsx
    const firstBytes = new Uint8Array(arrayBuffer.slice(0, 15));
    const firstChars = new TextDecoder().decode(firstBytes).toLowerCase();
    if (firstChars.includes('<!doctype') || firstChars.includes('<html')) {
      return {
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'File could not be retrieved. Please verify the link has "Anyone with the link" access enabled.',
        },
      };
    }

    // Extract filename from Content-Disposition header, or derive from fileId
    const contentDisposition = response.headers.get('content-disposition');
    let fileName = `${fileId}.xlsx`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|['"]?)([^'";\n]+)/i);
      if (filenameMatch && filenameMatch[1]) {
        fileName = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
      }
    }

    return {
      success: true,
      file: arrayBuffer,
      fileName,
      fileSize: arrayBuffer.byteLength,
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message:
            'Download failed due to a network issue. Please check your connection and try again',
        },
      };
    }

    // Handle TypeError which often indicates CORS blocking
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message:
            'Download blocked (CORS). For Google Sheets, ensure the file is shared as "Anyone with the link" and use the spreadsheet URL format: https://docs.google.com/spreadsheets/d/{id}/edit',
        },
      };
    }

    // Handle other fetch errors (network failures, DNS issues, etc.)
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          'Download failed due to a network issue. Please check your connection and try again',
      },
    };
  }
}
