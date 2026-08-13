import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HeatmapGrid } from './HeatmapGrid';
import type { TimesheetData } from '../../types';

const mockData: TimesheetData[] = [
  {
    workbookId: 'wb-1',
    resourceName: 'Alice Johnson',
    entries: [
      { date: '2026-07-01', taskDescription: 'Task A', hoursWorked: 8, projectName: 'ProjectAlpha', sourceDocLink: '' },
      { date: '2026-07-02', taskDescription: 'Task B', hoursWorked: 6, projectName: 'ProjectAlpha', sourceDocLink: '' },
      { date: '2026-07-03', taskDescription: 'Task C', hoursWorked: 4, projectName: 'ProjectAlpha', sourceDocLink: '' },
      // July 5, 2026 is a Saturday - no entry expected
      { date: '2026-07-07', taskDescription: 'Task D', hoursWorked: 9, projectName: 'ProjectAlpha', sourceDocLink: '' },
    ],
  },
  {
    workbookId: 'wb-1',
    resourceName: 'Bob Smith',
    entries: [
      { date: '2026-07-01', taskDescription: 'Task X', hoursWorked: 2, projectName: 'ProjectBeta', sourceDocLink: '' },
      { date: '2026-07-02', taskDescription: 'Task Y', hoursWorked: 0, projectName: 'ProjectBeta', sourceDocLink: '' },
    ],
  },
];

describe('HeatmapGrid', () => {
  it('renders empty state when no data is provided', () => {
    render(<HeatmapGrid data={[]} month="July" year={2026} workingDays={22} />);
    expect(
      screen.getByText('Import timesheet data to view monthly summaries')
    ).toBeInTheDocument();
  });

  it('renders the heatmap grid when data is provided', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    // Should display resource names
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
  });

  it('renders day column headers for the correct number of days', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    // July has 31 days
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders correct number of days for February in non-leap year', () => {
    const febData: TimesheetData[] = [
      {
        workbookId: 'wb-1',
        resourceName: 'Test User',
        entries: [
          { date: '2025-02-01', taskDescription: 'Task', hoursWorked: 5, projectName: 'P', sourceDocLink: '' },
        ],
      },
    ];
    render(<HeatmapGrid data={febData} month="February" year={2025} workingDays={20} />);
    expect(screen.getByText('28')).toBeInTheDocument();
    // Day 29 should not exist for non-leap Feb
    expect(screen.queryByText('29')).not.toBeInTheDocument();
  });

  it('renders correct number of days for February in leap year', () => {
    const febData: TimesheetData[] = [
      {
        workbookId: 'wb-1',
        resourceName: 'Test User',
        entries: [
          { date: '2024-02-01', taskDescription: 'Task', hoursWorked: 5, projectName: 'P', sourceDocLink: '' },
        ],
      },
    ];
    render(<HeatmapGrid data={febData} month="February" year={2024} workingDays={20} />);
    expect(screen.getByText('29')).toBeInTheDocument();
  });

  it('renders cells with appropriate aria labels for accessibility', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    // July 5, 2026 is a Saturday - should have weekend label
    const weekendCell = screen.getByLabelText('Alice Johnson, Day 5: 0.0 hours (Weekend)');
    expect(weekendCell).toBeInTheDocument();
  });

  it('renders cells with missing entry label for zero-hour weekdays', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    // Day 8 is a Tuesday with no entry for Alice
    const missingCell = screen.getByLabelText('Alice Johnson, Day 8: 0.0 hours (Missing entry)');
    expect(missingCell).toBeInTheDocument();
  });

  it('displays the legend section', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    expect(screen.getByText('Hours:')).toBeInTheDocument();
    expect(screen.getByText('Weekend')).toBeInTheDocument();
    expect(screen.getByText('Missing entry')).toBeInTheDocument();
  });

  it('shows empty state when data has no matching entries for the month', () => {
    const noMatchData: TimesheetData[] = [
      {
        workbookId: 'wb-1',
        resourceName: 'Test User',
        entries: [
          { date: '2026-08-01', taskDescription: 'Task', hoursWorked: 5, projectName: 'P', sourceDocLink: '' },
        ],
      },
    ];
    render(<HeatmapGrid data={noMatchData} month="July" year={2026} workingDays={22} />);
    expect(screen.getByText('No data available for July 2026')).toBeInTheDocument();
  });

  it('has a table role for accessibility', () => {
    render(<HeatmapGrid data={mockData} month="July" year={2026} workingDays={22} />);
    expect(screen.getByRole('table', { name: /Heatmap for July 2026/i })).toBeInTheDocument();
  });
});
