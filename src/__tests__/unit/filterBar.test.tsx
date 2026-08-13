/**
 * Unit tests for the FilterBar component.
 *
 * Validates: Requirements 11.1, 11.4, 11.5, 11.6
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../../components/FilterBar';
import { AppProvider } from '../../state/AppContext';

describe('FilterBar', () => {
  describe('rendering', () => {
    it('renders the filter bar container', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      expect(screen.getByTestId('filter-bar')).toBeInTheDocument();
    });

    it('renders all four filter dropdowns', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      expect(screen.getByTestId('filter-projects')).toBeInTheDocument();
      expect(screen.getByTestId('filter-resources')).toBeInTheDocument();
      expect(screen.getByTestId('filter-months')).toBeInTheDocument();
      expect(screen.getByTestId('filter-categories')).toBeInTheDocument();
    });

    it('shows dropdown labels when no filters are selected', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      expect(screen.getByText('Project')).toBeInTheDocument();
      expect(screen.getByText('Resource')).toBeInTheDocument();
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    it('does not show filter chips when no filters are active', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
    });

    it('does not show Clear All Filters button when no filters are active', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      expect(screen.queryByTestId('clear-all-filters')).not.toBeInTheDocument();
    });
  });

  describe('category dropdown', () => {
    it('opens category dropdown and shows fixed options', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      expect(screen.getByText('over-utilized')).toBeInTheDocument();
      expect(screen.getByText('under-utilized')).toBeInTheDocument();
      expect(screen.getByText('optimally-utilized')).toBeInTheDocument();
    });

    it('selects a category and shows filter chip', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Open category dropdown
      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      // Select over-utilized
      const checkbox = screen.getByText('over-utilized')
        .closest('label')!
        .querySelector('input')!;
      fireEvent.click(checkbox);

      // Should show chip
      expect(screen.getByTestId('filter-chips')).toBeInTheDocument();
      expect(screen.getByText('Category: Over-utilized')).toBeInTheDocument();
    });

    it('shows Clear All Filters button when a filter is active', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Open category dropdown and select
      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      const checkbox = screen.getByText('over-utilized')
        .closest('label')!
        .querySelector('input')!;
      fireEvent.click(checkbox);

      expect(screen.getByTestId('clear-all-filters')).toBeInTheDocument();
    });
  });

  describe('clearing filters', () => {
    it('removes a single filter when chip x is clicked', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Add a filter
      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      const checkbox = screen.getByText('over-utilized')
        .closest('label')!
        .querySelector('input')!;
      fireEvent.click(checkbox);

      // Find and click the remove button on the chip
      const removeButton = screen.getByLabelText('Remove filter: Category: Over-utilized');
      fireEvent.click(removeButton);

      // Chip should be gone
      expect(screen.queryByText('Category: Over-utilized')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
    });

    it('clears all filters when Clear All Filters is clicked', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Add two category filters
      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      const overCheckbox = screen.getByText('over-utilized')
        .closest('label')!
        .querySelector('input')!;
      fireEvent.click(overCheckbox);

      const underCheckbox = screen.getByText('under-utilized')
        .closest('label')!
        .querySelector('input')!;
      fireEvent.click(underCheckbox);

      // Both chips visible
      expect(screen.getByText('Category: Over-utilized')).toBeInTheDocument();
      expect(screen.getByText('Category: Under-utilized')).toBeInTheDocument();

      // Click Clear All
      fireEvent.click(screen.getByTestId('clear-all-filters'));

      // All chips gone
      expect(screen.queryByTestId('filter-chips')).not.toBeInTheDocument();
    });
  });

  describe('dropdown interaction', () => {
    it('closes dropdown when clicking outside', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Open category dropdown
      const categoryButton = screen.getByText('Category');
      fireEvent.click(categoryButton);

      expect(screen.getByText('over-utilized')).toBeInTheDocument();

      // Click outside the dropdown
      fireEvent.mouseDown(document.body);

      // Dropdown options should be hidden
      expect(screen.queryByText('over-utilized')).not.toBeInTheDocument();
    });

    it('shows "No options available" for empty project list', () => {
      render(
        <AppProvider>
          <FilterBar />
        </AppProvider>
      );

      // Open project dropdown (no data imported)
      const projectButton = screen.getByText('Project');
      fireEvent.click(projectButton);

      expect(screen.getByText('No options available')).toBeInTheDocument();
    });
  });
});
