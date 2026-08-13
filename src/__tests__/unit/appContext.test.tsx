/**
 * Unit tests for AppContext: reducer logic, provider, and useAppContext hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { appReducer, initialState, AppProvider, useAppContext } from '../../state/AppContext';
import type { AppState, AppAction } from '../../types/state';
import type { WorkbookMetadata, TimesheetData } from '../../types/index';

describe('appReducer', () => {
  describe('IMPORT_WORKBOOK', () => {
    it('adds metadata and timesheets to state', () => {
      const metadata: WorkbookMetadata = {
        id: 'wb-1',
        projectName: 'ProjectA',
        month: 'July',
        year: 2026,
        fileName: 'ProjectA_July_2026.xlsx',
        origin: 'local',
        fileSize: 1024,
        importedAt: '2026-07-01T00:00:00Z',
        resourceCount: 2,
      };
      const timesheets: TimesheetData[] = [
        { workbookId: 'wb-1', resourceName: 'Alice', entries: [] },
        { workbookId: 'wb-1', resourceName: 'Bob', entries: [] },
      ];

      const action: AppAction = {
        type: 'IMPORT_WORKBOOK',
        payload: { metadata, timesheets },
      };

      const newState = appReducer(initialState, action);

      expect(newState.workbooks).toHaveLength(1);
      expect(newState.workbooks[0]).toEqual(metadata);
      expect(newState.timesheets).toHaveLength(2);
      expect(newState.timesheets[0].resourceName).toBe('Alice');
      expect(newState.timesheets[1].resourceName).toBe('Bob');
    });
  });

  describe('REMOVE_WORKBOOK', () => {
    it('removes workbook and associated timesheets', () => {
      const stateWithData: AppState = {
        ...initialState,
        workbooks: [
          { id: 'wb-1', projectName: 'A', month: 'July', year: 2026, fileName: 'a.xlsx', origin: 'local', fileSize: 100, importedAt: '', resourceCount: 1 },
          { id: 'wb-2', projectName: 'B', month: 'Aug', year: 2026, fileName: 'b.xlsx', origin: 'local', fileSize: 200, importedAt: '', resourceCount: 1 },
        ],
        timesheets: [
          { workbookId: 'wb-1', resourceName: 'Alice', entries: [] },
          { workbookId: 'wb-2', resourceName: 'Bob', entries: [] },
        ],
      };

      const action: AppAction = { type: 'REMOVE_WORKBOOK', payload: { workbookId: 'wb-1' } };
      const newState = appReducer(stateWithData, action);

      expect(newState.workbooks).toHaveLength(1);
      expect(newState.workbooks[0].id).toBe('wb-2');
      expect(newState.timesheets).toHaveLength(1);
      expect(newState.timesheets[0].workbookId).toBe('wb-2');
    });
  });

  describe('UPDATE_THRESHOLDS', () => {
    it('updates threshold configuration', () => {
      const action: AppAction = {
        type: 'UPDATE_THRESHOLDS',
        payload: { minOptimalHours: 120, maxOptimalHours: 160 },
      };

      const newState = appReducer(initialState, action);

      expect(newState.config.thresholds.minOptimalHours).toBe(120);
      expect(newState.config.thresholds.maxOptimalHours).toBe(160);
    });
  });

  describe('UPDATE_WORKING_DAYS', () => {
    it('updates working days per month', () => {
      const action: AppAction = { type: 'UPDATE_WORKING_DAYS', payload: 20 };
      const newState = appReducer(initialState, action);
      expect(newState.config.workingDaysPerMonth).toBe(20);
    });
  });

  describe('UPDATE_DAILY_HOURS', () => {
    it('updates daily hour expectation', () => {
      const action: AppAction = { type: 'UPDATE_DAILY_HOURS', payload: 7 };
      const newState = appReducer(initialState, action);
      expect(newState.config.dailyHourExpectation).toBe(7);
    });
  });

  describe('UPDATE_BUFFER_DAYS', () => {
    it('sets buffer days for a specific resource and month', () => {
      const action: AppAction = {
        type: 'UPDATE_BUFFER_DAYS',
        payload: { resourceName: 'Alice', month: 'July', days: 3 },
      };

      const newState = appReducer(initialState, action);

      expect(newState.config.resourceBufferDays['Alice']['July']).toBe(3);
    });

    it('preserves existing buffer days for other months', () => {
      const stateWithBuffers: AppState = {
        ...initialState,
        config: {
          ...initialState.config,
          resourceBufferDays: { Alice: { June: 2 } },
        },
      };

      const action: AppAction = {
        type: 'UPDATE_BUFFER_DAYS',
        payload: { resourceName: 'Alice', month: 'July', days: 3 },
      };

      const newState = appReducer(stateWithBuffers, action);

      expect(newState.config.resourceBufferDays['Alice']['June']).toBe(2);
      expect(newState.config.resourceBufferDays['Alice']['July']).toBe(3);
    });
  });

  describe('SET_FILTERS', () => {
    it('merges partial filter state', () => {
      const action: AppAction = {
        type: 'SET_FILTERS',
        payload: { projects: ['ProjectA', 'ProjectB'] },
      };

      const newState = appReducer(initialState, action);

      expect(newState.filters.projects).toEqual(['ProjectA', 'ProjectB']);
      expect(newState.filters.resources).toEqual([]);
      expect(newState.filters.months).toEqual([]);
      expect(newState.filters.categories).toEqual([]);
    });
  });

  describe('CLEAR_FILTERS', () => {
    it('resets all filters to empty arrays', () => {
      const stateWithFilters: AppState = {
        ...initialState,
        filters: {
          projects: ['A'],
          resources: ['Bob'],
          months: ['July 2026'],
          categories: ['over-utilized'],
        },
      };

      const action: AppAction = { type: 'CLEAR_FILTERS' };
      const newState = appReducer(stateWithFilters, action);

      expect(newState.filters.projects).toEqual([]);
      expect(newState.filters.resources).toEqual([]);
      expect(newState.filters.months).toEqual([]);
      expect(newState.filters.categories).toEqual([]);
    });
  });

  describe('SET_VIEW', () => {
    it('changes the active view', () => {
      const action: AppAction = { type: 'SET_VIEW', payload: 'projects' };
      const newState = appReducer(initialState, action);
      expect(newState.activeView).toBe('projects');
    });
  });

  describe('SET_AI_INSIGHTS', () => {
    it('replaces AI insights array', () => {
      const insights = [
        { title: 'Insight 1', description: 'Desc', severity: 'high' as const },
      ];
      const action: AppAction = { type: 'SET_AI_INSIGHTS', payload: insights };
      const newState = appReducer(initialState, action);
      expect(newState.aiInsights).toEqual(insights);
    });
  });

  describe('SET_AI_STATUS', () => {
    it('updates AI status', () => {
      const action: AppAction = { type: 'SET_AI_STATUS', payload: 'loading' };
      const newState = appReducer(initialState, action);
      expect(newState.aiStatus).toBe('loading');
    });
  });

  describe('unknown action', () => {
    it('returns state unchanged for unknown action type', () => {
      const action = { type: 'UNKNOWN_ACTION' } as unknown as AppAction;
      const newState = appReducer(initialState, action);
      expect(newState).toBe(initialState);
    });
  });
});

describe('initialState', () => {
  it('has correct default configuration values', () => {
    expect(initialState.config.thresholds.minOptimalHours).toBe(140);
    expect(initialState.config.thresholds.maxOptimalHours).toBe(176);
    expect(initialState.config.workingDaysPerMonth).toBe(22);
    expect(initialState.config.dailyHourExpectation).toBe(8);
    expect(initialState.config.resourceBufferDays).toEqual({});
  });

  it('has empty collections', () => {
    expect(initialState.workbooks).toEqual([]);
    expect(initialState.timesheets).toEqual([]);
    expect(initialState.aiInsights).toEqual([]);
  });

  it('has correct default filter state', () => {
    expect(initialState.filters).toEqual({
      projects: [],
      resources: [],
      months: [],
      categories: [],
    });
  });

  it('has correct default view and AI status', () => {
    expect(initialState.activeView).toBe('overview');
    expect(initialState.aiStatus).toBe('unavailable');
  });
});

describe('useAppContext', () => {
  it('throws an error when used outside AppProvider', () => {
    expect(() => {
      renderHook(() => useAppContext());
    }).toThrow('useAppContext must be used within an AppProvider');
  });

  it('provides state and dispatch when used within AppProvider', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    expect(result.current.state).toEqual(initialState);
    expect(typeof result.current.dispatch).toBe('function');
  });

  it('updates state when dispatch is called', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: ({ children }) => <AppProvider>{children}</AppProvider>,
    });

    act(() => {
      result.current.dispatch({ type: 'SET_VIEW', payload: 'resources' });
    });

    expect(result.current.state.activeView).toBe('resources');
  });
});
