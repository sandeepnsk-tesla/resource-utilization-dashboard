/**
 * Unit tests for the MetricsPanel component.
 *
 * Validates: Requirements 12.1, 12.3, 12.4, 12.5
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MetricsPanel } from '../../components/MetricsPanel';
import { AppProvider, useAppContext } from '../../state/AppContext';
import type { TimesheetData, WorkbookMetadata } from '../../types/index';

/** Creates mock timesheet data for a given resource */
function createMockTimesheet(
  resourceName: string,
  workbookId: string,
  hours: number[],
  projectName = 'Project Alpha',
  month = '2026-07'
): TimesheetData {
  return {
    workbookId,
    resourceName,
    entries: hours.map((h, i) => ({
      date: `${month}-${String(i + 1).padStart(2, '0')}`,
      taskDescription: `Task ${i + 1}`,
      hoursWorked: h,
      projectName,
      sourceDocLink: '',
    })),
  };
}

/**
 * Renders MetricsPanel inside AppProvider and dispatches an import action
 * to seed state with 2+ resources, then returns the result.
 */
function renderWithData() {
  const metadata: WorkbookMetadata = {
    id: 'wb-1',
    projectName: 'Project Alpha',
    month: 'July',
    year: 2026,
    fileName: 'ProjectAlpha_July_2026.xlsx',
    origin: 'local',
    fileSize: 1024,
    importedAt: '2026-07-01T00:00:00Z',
    resourceCount: 3,
  };

  const timesheets: TimesheetData[] = [
    createMockTimesheet('Alice', 'wb-1', [8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]),
    createMockTimesheet('Bob', 'wb-1', [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]),
    createMockTimesheet('Charlie', 'wb-1', [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
  ];

  // Use a helper component that dispatches the import action via useEffect
  function Seeder() {
    const { dispatch } = useAppContext();
    // Using a ref-style pattern: dispatch immediately in effect
    React.useEffect(() => {
      dispatch({ type: 'IMPORT_WORKBOOK', payload: { metadata, timesheets } });
    }, []);
    return null;
  }

  let result: ReturnType<typeof render>;
  act(() => {
    result = render(
      <AppProvider>
        <Seeder />
        <MetricsPanel />
      </AppProvider>
    );
  });

  return result!;
}

describe('MetricsPanel', () => {
  describe('empty state / insufficient data (Requirement 12.5)', () => {
    it('shows message when no data is imported', () => {
      render(
        <AppProvider>
          <MetricsPanel />
        </AppProvider>
      );

      expect(
        screen.getByText('Import data for at least 2 resources to view meaningful metrics')
      ).toBeInTheDocument();
    });

    it('does not show metric cards when no data is imported', () => {
      render(
        <AppProvider>
          <MetricsPanel />
        </AppProvider>
      );

      expect(screen.queryByText('Avg Utilization')).not.toBeInTheDocument();
      expect(screen.queryByText('Over-Utilized')).not.toBeInTheDocument();
      expect(screen.queryByText('Under-Utilized')).not.toBeInTheDocument();
      expect(screen.queryByText('Available Capacity')).not.toBeInTheDocument();
      expect(screen.queryByText('Highest Utilized')).not.toBeInTheDocument();
    });
  });

  describe('with sufficient data (Requirements 12.1, 12.3, 12.4)', () => {
    it('renders all 5 metric cards when 2+ resources are available', () => {
      renderWithData();

      expect(screen.getByText('Avg Utilization')).toBeInTheDocument();
      expect(screen.getByText('Over-Utilized')).toBeInTheDocument();
      expect(screen.getByText('Under-Utilized')).toBeInTheDocument();
      expect(screen.getByText('Available Capacity')).toBeInTheDocument();
      expect(screen.getByText('Highest Utilized')).toBeInTheDocument();
    });

    it('displays the highest utilized resource name', () => {
      renderWithData();

      // Charlie has 220 hours (10*22), highest among the three
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('hides the insufficient data message when data is present', () => {
      renderWithData();

      expect(
        screen.queryByText('Import data for at least 2 resources to view meaningful metrics')
      ).not.toBeInTheDocument();
    });

    it('shows no trend indicators when no previous month data exists (Requirement 12.4)', () => {
      renderWithData();

      // With single-month data, trends should be null (no arrows rendered)
      expect(screen.queryByLabelText('Trend up')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Trend down')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Trend neutral')).not.toBeInTheDocument();
    });
  });
});
