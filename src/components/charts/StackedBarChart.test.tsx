import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StackedBarChart } from './StackedBarChart';
import type { AggregatedProjectData } from '../../types';
import type { UtilizationCategory } from '../../types/config';

describe('StackedBarChart', () => {
  it('renders empty state when data is empty', () => {
    render(<StackedBarChart data={[]} />);
    expect(
      screen.getByText('No project data available for stacked chart')
    ).toBeInTheDocument();
  });

  it('renders chart container when data is provided', () => {
    const data: AggregatedProjectData[] = [
      {
        projectName: 'Project Alpha',
        month: 'July',
        year: 2026,
        totalHours: 300,
        activeResourceCount: 2,
        resources: [
          { resourceName: 'Alice', hours: 160, category: 'optimally-utilized' as UtilizationCategory },
          { resourceName: 'Bob', hours: 140, category: 'under-utilized' as UtilizationCategory },
        ],
        averageUtilizationPercentage: 85,
      },
      {
        projectName: 'Project Alpha',
        month: 'August',
        year: 2026,
        totalHours: 350,
        activeResourceCount: 2,
        resources: [
          { resourceName: 'Alice', hours: 180, category: 'over-utilized' as UtilizationCategory },
          { resourceName: 'Bob', hours: 170, category: 'optimally-utilized' as UtilizationCategory },
        ],
        averageUtilizationPercentage: 99,
      },
    ];

    const { container } = render(<StackedBarChart data={data} />);

    // The chart should be rendered inside a responsive container
    const wrapper = container.querySelector('.w-full.h-80');
    expect(wrapper).toBeInTheDocument();

    // Should NOT show empty state
    expect(
      screen.queryByText('No project data available for stacked chart')
    ).not.toBeInTheDocument();
  });

  it('does not render empty state for single month data', () => {
    const data: AggregatedProjectData[] = [
      {
        projectName: 'Project Beta',
        month: 'June',
        year: 2026,
        totalHours: 160,
        activeResourceCount: 1,
        resources: [
          { resourceName: 'Charlie', hours: 160, category: 'optimally-utilized' as UtilizationCategory },
        ],
        averageUtilizationPercentage: 91,
      },
    ];

    render(<StackedBarChart data={data} />);
    expect(
      screen.queryByText('No project data available for stacked chart')
    ).not.toBeInTheDocument();
  });
});
