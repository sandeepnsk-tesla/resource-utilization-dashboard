/**
 * Unit tests for the AIInsightsPanel component.
 *
 * Validates: Requirements 13.1, 13.2, 13.4, 13.5
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AIInsightsPanel } from '../../components/AIInsightsPanel';
import { AppProvider, useAppContext } from '../../state/AppContext';
import type { AIInsight } from '../../types/ai';

/** Helper to render AIInsightsPanel and optionally dispatch state changes */
function renderWithState(setup?: (dispatch: React.Dispatch<any>) => void) {
  function Seeder() {
    const { dispatch } = useAppContext();
    React.useEffect(() => {
      if (setup) setup(dispatch);
    }, []);
    return null;
  }

  let result: ReturnType<typeof render>;
  act(() => {
    result = render(
      <AppProvider>
        <Seeder />
        <AIInsightsPanel />
      </AppProvider>
    );
  });

  return result!;
}

describe('AIInsightsPanel', () => {
  describe('unavailable state (Requirement 13.2)', () => {
    it('shows "Coming Soon" placeholder when aiStatus is unavailable', () => {
      // Default state has aiStatus = 'unavailable'
      renderWithState();

      expect(
        screen.getByText('Coming Soon — AI-powered insights will appear here')
      ).toBeInTheDocument();
    });

    it('does not render insight cards in unavailable state', () => {
      renderWithState();

      expect(screen.queryByRole('heading', { level: 4 })).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows spinner when aiStatus is loading', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'loading' });
      });

      expect(screen.getByText('Loading insights…')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading AI insights')).toBeInTheDocument();
    });
  });

  describe('error state (Requirement 13.5)', () => {
    it('shows error message when aiStatus is error', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'error' });
      });

      expect(
        screen.getByText('Unable to retrieve AI insights at this time')
      ).toBeInTheDocument();
    });
  });

  describe('insights display (Requirement 13.4)', () => {
    const mockInsights: AIInsight[] = [
      { title: 'Low Insight', description: 'Low severity insight description', severity: 'low' },
      { title: 'High Insight', description: 'High severity insight description', severity: 'high' },
      { title: 'Medium Insight', description: 'Medium severity insight description', severity: 'medium' },
    ];

    it('displays insight cards sorted by severity (high → medium → low)', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'idle' });
        dispatch({ type: 'SET_AI_INSIGHTS', payload: mockInsights });
      });

      const titles = screen.getAllByRole('heading', { level: 4 });
      expect(titles[0]).toHaveTextContent('High Insight');
      expect(titles[1]).toHaveTextContent('Medium Insight');
      expect(titles[2]).toHaveTextContent('Low Insight');
    });

    it('displays severity badges with correct text', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'idle' });
        dispatch({ type: 'SET_AI_INSIGHTS', payload: mockInsights });
      });

      expect(screen.getByText('high')).toBeInTheDocument();
      expect(screen.getByText('medium')).toBeInTheDocument();
      expect(screen.getByText('low')).toBeInTheDocument();
    });

    it('displays title and description for each insight', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'idle' });
        dispatch({ type: 'SET_AI_INSIGHTS', payload: mockInsights });
      });

      expect(screen.getByText('High Insight')).toBeInTheDocument();
      expect(screen.getByText('High severity insight description')).toBeInTheDocument();
      expect(screen.getByText('Medium Insight')).toBeInTheDocument();
      expect(screen.getByText('Medium severity insight description')).toBeInTheDocument();
      expect(screen.getByText('Low Insight')).toBeInTheDocument();
      expect(screen.getByText('Low severity insight description')).toBeInTheDocument();
    });

    it('limits displayed insights to MAX_AI_INSIGHTS (20)', () => {
      const manyInsights: AIInsight[] = Array.from({ length: 25 }, (_, i) => ({
        title: `Insight ${i + 1}`,
        description: `Description for insight ${i + 1}`,
        severity: 'medium' as const,
      }));

      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'idle' });
        dispatch({ type: 'SET_AI_INSIGHTS', payload: manyInsights });
      });

      const titles = screen.getAllByRole('heading', { level: 4 });
      expect(titles).toHaveLength(20);
    });

    it('shows empty message when idle with no insights', () => {
      renderWithState((dispatch) => {
        dispatch({ type: 'SET_AI_STATUS', payload: 'idle' });
        dispatch({ type: 'SET_AI_INSIGHTS', payload: [] });
      });

      expect(screen.getByText('No AI insights available')).toBeInTheDocument();
    });
  });
});
