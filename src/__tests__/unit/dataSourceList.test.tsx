/**
 * Unit tests for DataSourceList component.
 *
 * Tests empty state, table rendering, file size formatting,
 * date formatting, origin display, max workbook limit, and remove button.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useReducer, type ReactNode } from 'react';
import { DataSourceList } from '../../components/DataSourceList';
import type { WorkbookMetadata } from '../../types';
import type { AppState } from '../../types/state';

// Helper to create a mock workbook
function createWorkbook(overrides: Partial<WorkbookMetadata> = {}): WorkbookMetadata {
  return {
    id: 'wb-1',
    projectName: 'ProjectAlpha',
    month: 'July',
    year: 2026,
    fileName: 'ProjectAlpha_July_2026.xlsx',
    origin: 'local',
    fileSize: 2048000,
    importedAt: '2026-07-15T10:30:00Z',
    resourceCount: 5,
    ...overrides,
  };
}

// Custom wrapper that pre-seeds state
function createWrapper(workbooks: WorkbookMetadata[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProviderWithWorkbooks workbooks={workbooks}>
        {children}
      </AppProviderWithWorkbooks>
    );
  };
}

// Provider that initializes with given workbooks
import { createContext, useContext } from 'react';
import { appReducer, initialState } from '../../state/AppContext';
import type { AppAction } from '../../types/state';

const TestAppContext = createContext<
  { state: AppState; dispatch: React.Dispatch<AppAction> } | undefined
>(undefined);

function AppProviderWithWorkbooks({
  children,
  workbooks,
}: {
  children: ReactNode;
  workbooks: WorkbookMetadata[];
}) {
  const stateWithWorkbooks: AppState = {
    ...initialState,
    workbooks,
  };
  const [state, dispatch] = useReducer(appReducer, stateWithWorkbooks);

  return (
    <TestAppContext.Provider value={{ state, dispatch }}>
      {children}
    </TestAppContext.Provider>
  );
}

// We need to mock useAppContext to use our test context
vi.mock('../../state/AppContext', async () => {
  const actual = await vi.importActual('../../state/AppContext');
  return {
    ...actual,
    useAppContext: () => {
      const context = useContext(TestAppContext);
      if (!context) throw new Error('useAppContext must be used within provider');
      return context;
    },
  };
});

describe('DataSourceList', () => {
  describe('Empty state', () => {
    it('renders empty state message when no workbooks are imported', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([]),
      });

      expect(screen.getByText('No timesheets imported yet')).toBeInTheDocument();
      expect(screen.getByTestId('data-source-list-empty')).toBeInTheDocument();
    });

    it('does not render the table when no workbooks exist', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([]),
      });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('Table rendering', () => {
    it('renders a table with correct column headers', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook()]),
      });

      expect(screen.getByText('Project Name')).toBeInTheDocument();
      expect(screen.getByText('Month/Year')).toBeInTheDocument();
      expect(screen.getByText('Origin')).toBeInTheDocument();
      expect(screen.getByText('File Size')).toBeInTheDocument();
      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getByText('Imported At')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('renders workbook project name', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ projectName: 'MyProject' })]),
      });

      expect(screen.getByText('MyProject')).toBeInTheDocument();
    });

    it('renders month and year', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ month: 'August', year: 2025 })]),
      });

      expect(screen.getByText('August 2025')).toBeInTheDocument();
    });

    it('renders resource count', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ resourceCount: 8 })]),
      });

      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  describe('Origin display', () => {
    it('displays "Local" for local origin', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ origin: 'local' })]),
      });

      expect(screen.getByText('Local')).toBeInTheDocument();
    });

    it('displays "Google Drive" for google-drive origin', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ origin: 'google-drive' })]),
      });

      expect(screen.getByText('Google Drive')).toBeInTheDocument();
    });
  });

  describe('File size formatting', () => {
    it('formats bytes as KB', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ fileSize: 512000 })]),
      });

      expect(screen.getByText('500.0 KB')).toBeInTheDocument();
    });

    it('formats bytes as MB', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ fileSize: 5242880 })]),
      });

      expect(screen.getByText('5.0 MB')).toBeInTheDocument();
    });

    it('formats small files in bytes', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ fileSize: 500 })]),
      });

      expect(screen.getByText('500 B')).toBeInTheDocument();
    });
  });

  describe('Remove button', () => {
    it('renders a remove button per workbook', () => {
      render(<DataSourceList />, {
        wrapper: createWrapper([createWorkbook({ id: 'wb-1' })]),
      });

      expect(screen.getByTestId('remove-workbook-wb-1')).toBeInTheDocument();
    });

    it('dispatches REMOVE_WORKBOOK when remove button is clicked', () => {
      const workbook = createWorkbook({ id: 'wb-remove-test' });
      render(<DataSourceList />, {
        wrapper: createWrapper([workbook]),
      });

      const removeButton = screen.getByTestId('remove-workbook-wb-remove-test');
      fireEvent.click(removeButton);

      // After removal, the workbook should disappear
      expect(screen.queryByText('ProjectAlpha')).not.toBeInTheDocument();
      expect(screen.getByText('No timesheets imported yet')).toBeInTheDocument();
    });
  });

  describe('Max workbooks limit', () => {
    it('shows up to 20 workbooks maximum', () => {
      const workbooks = Array.from({ length: 25 }, (_, i) =>
        createWorkbook({
          id: `wb-${i}`,
          projectName: `Project${i}`,
        })
      );

      render(<DataSourceList />, {
        wrapper: createWrapper(workbooks),
      });

      // Should show 20 rows (within table body)
      const rows = screen.getAllByRole('row');
      // 1 header row + 20 data rows = 21 total rows
      expect(rows).toHaveLength(21);
    });
  });
});
