import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UtilizationBarChart } from './UtilizationBarChart';
import type { AggregatedResourceData } from '../../types';
import { UTILIZATION_COLORS } from '../../constants/validation';

const mockData: AggregatedResourceData[] = [
  {
    resourceName: 'Alice Johnson',
    month: 'July',
    year: 2026,
    totalHours: 190,
    projects: [
      { projectName: 'Project Alpha', hours: 120 },
      { projectName: 'Project Beta', hours: 70 },
    ],
    taskCount: 25,
    effectiveAvailableHours: 176,
    utilizationCategory: 'over-utilized',
    utilizationPercentage: 108,
  },
  {
    resourceName: 'Bob Smith',
    month: 'July',
    year: 2026,
    totalHours: 100,
    projects: [{ projectName: 'Project Alpha', hours: 100 }],
    taskCount: 15,
    effectiveAvailableHours: 176,
    utilizationCategory: 'under-utilized',
    utilizationPercentage: 57,
  },
  {
    resourceName: 'Carol Davis',
    month: 'July',
    year: 2026,
    totalHours: 160,
    projects: [
      { projectName: 'Project Alpha', hours: 80 },
      { projectName: 'Project Gamma', hours: 80 },
    ],
    taskCount: 20,
    effectiveAvailableHours: 176,
    utilizationCategory: 'optimally-utilized',
    utilizationPercentage: 91,
  },
];

describe('UtilizationBarChart', () => {
  it('renders empty state message when data is empty', () => {
    render(<UtilizationBarChart data={[]} />);
    expect(
      screen.getByText('Import timesheet data to view utilization charts')
    ).toBeInTheDocument();
  });

  it('does not show empty state when data is provided', () => {
    render(<UtilizationBarChart data={mockData} />);
    expect(
      screen.queryByText('Import timesheet data to view utilization charts')
    ).not.toBeInTheDocument();
  });

  it('renders the chart container when data is provided', () => {
    const { container } = render(<UtilizationBarChart data={mockData} />);
    // Recharts renders an SVG-based chart inside a ResponsiveContainer
    const wrapper = container.querySelector('.recharts-responsive-container');
    expect(wrapper).toBeInTheDocument();
  });

  it('uses correct colors from UTILIZATION_COLORS', () => {
    // Verify our constants match the specification
    expect(UTILIZATION_COLORS['over-utilized']).toBe('#E53935');
    expect(UTILIZATION_COLORS['under-utilized']).toBe('#FFA726');
    expect(UTILIZATION_COLORS['optimally-utilized']).toBe('#43A047');
  });
});
