import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HorizontalBarChart } from './HorizontalBarChart';
import type { HorizontalBarChartDataItem } from './HorizontalBarChart';

const mockData: HorizontalBarChartDataItem[] = [
  { projectName: 'Project Alpha', hours: 80 },
  { projectName: 'Project Beta', hours: 45 },
  { projectName: 'Project Gamma', hours: 30 },
];

describe('HorizontalBarChart', () => {
  it('renders empty state message when data is empty', () => {
    render(<HorizontalBarChart data={[]} />);
    expect(
      screen.getByText('No project data available for this resource')
    ).toBeInTheDocument();
  });

  it('does not show empty state when data is provided', () => {
    render(<HorizontalBarChart data={mockData} />);
    expect(
      screen.queryByText('No project data available for this resource')
    ).not.toBeInTheDocument();
  });

  it('renders the chart container when data is provided', () => {
    const { container } = render(<HorizontalBarChart data={mockData} />);
    const wrapper = container.querySelector('.recharts-responsive-container');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders with a single project entry', () => {
    const singleProject: HorizontalBarChartDataItem[] = [
      { projectName: 'Solo Project', hours: 120 },
    ];
    const { container } = render(<HorizontalBarChart data={singleProject} />);
    const wrapper = container.querySelector('.recharts-responsive-container');
    expect(wrapper).toBeInTheDocument();
  });
});
