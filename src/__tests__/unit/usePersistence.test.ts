/**
 * Unit tests for the usePersistence hooks and utility functions.
 * Tests localStorage persistence for config and sessionStorage for filters.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  loadPersistedConfig,
  saveConfig,
  loadPersistedFilters,
  saveFilters,
  usePersistence,
  useFilterPersistence,
  DEFAULT_APP_CONFIG,
  DEFAULT_FILTER_STATE,
} from '../../state/usePersistence';
import type { AppConfig, FilterState } from '../../types/config';
import type { AppState } from '../../types/state';

// Helper to build a minimal AppState for testing
function makeAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    workbooks: [],
    timesheets: [],
    config: DEFAULT_APP_CONFIG,
    filters: DEFAULT_FILTER_STATE,
    activeView: 'overview',
    aiInsights: [],
    aiStatus: 'idle',
    ...overrides,
  };
}

describe('loadPersistedConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no config is stored', () => {
    expect(loadPersistedConfig()).toBeNull();
  });

  it('returns stored config when valid data exists', () => {
    const config: AppConfig = {
      thresholds: { minOptimalHours: 120, maxOptimalHours: 160 },
      workingDaysPerMonth: 20,
      dailyHourExpectation: 7,
      resourceBufferDays: { Alice: { 'July 2026': 2 } },
    };
    localStorage.setItem('app-config', JSON.stringify(config));

    const result = loadPersistedConfig();
    expect(result).toEqual(config);
  });

  it('returns null for corrupted JSON', () => {
    localStorage.setItem('app-config', 'not valid json{{{');
    expect(loadPersistedConfig()).toBeNull();
  });

  it('returns null for data missing required fields', () => {
    localStorage.setItem('app-config', JSON.stringify({ thresholds: {} }));
    expect(loadPersistedConfig()).toBeNull();
  });

  it('returns null when thresholds has wrong types', () => {
    localStorage.setItem(
      'app-config',
      JSON.stringify({
        thresholds: { minOptimalHours: 'not a number', maxOptimalHours: 176 },
        workingDaysPerMonth: 22,
        dailyHourExpectation: 8,
        resourceBufferDays: {},
      })
    );
    expect(loadPersistedConfig()).toBeNull();
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves config to localStorage', () => {
    const config: AppConfig = {
      thresholds: { minOptimalHours: 130, maxOptimalHours: 170 },
      workingDaysPerMonth: 21,
      dailyHourExpectation: 8,
      resourceBufferDays: {},
    };
    saveConfig(config);

    const stored = JSON.parse(localStorage.getItem('app-config')!);
    expect(stored).toEqual(config);
  });

  it('handles storage errors gracefully', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    expect(() => saveConfig(DEFAULT_APP_CONFIG)).not.toThrow();
    spy.mockRestore();
  });
});

describe('loadPersistedFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when no filters are stored', () => {
    expect(loadPersistedFilters()).toBeNull();
  });

  it('returns stored filters when valid data exists', () => {
    const filters: FilterState = {
      projects: ['Alpha'],
      resources: ['Alice'],
      months: ['July 2026'],
      categories: ['over-utilized'],
    };
    sessionStorage.setItem('app-filters', JSON.stringify(filters));

    const result = loadPersistedFilters();
    expect(result).toEqual(filters);
  });

  it('returns null for corrupted JSON', () => {
    sessionStorage.setItem('app-filters', '{broken');
    expect(loadPersistedFilters()).toBeNull();
  });

  it('returns null for data with wrong shape', () => {
    sessionStorage.setItem('app-filters', JSON.stringify({ projects: 'not-an-array' }));
    expect(loadPersistedFilters()).toBeNull();
  });
});

describe('saveFilters', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves filters to sessionStorage', () => {
    const filters: FilterState = {
      projects: ['Beta'],
      resources: [],
      months: [],
      categories: ['under-utilized'],
    };
    saveFilters(filters);

    const stored = JSON.parse(sessionStorage.getItem('app-filters')!);
    expect(stored).toEqual(filters);
  });
});

describe('usePersistence hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not overwrite localStorage on initial render', () => {
    const existingConfig: AppConfig = {
      thresholds: { minOptimalHours: 100, maxOptimalHours: 200 },
      workingDaysPerMonth: 20,
      dailyHourExpectation: 7,
      resourceBufferDays: {},
    };
    localStorage.setItem('app-config', JSON.stringify(existingConfig));

    const state = makeAppState();
    renderHook(() => usePersistence(state));

    // Should not overwrite with default config
    const stored = JSON.parse(localStorage.getItem('app-config')!);
    expect(stored).toEqual(existingConfig);
  });

  it('saves config to localStorage when state.config changes', () => {
    const initialState = makeAppState();
    const { rerender } = renderHook(({ state }) => usePersistence(state), {
      initialProps: { state: initialState },
    });

    const updatedConfig: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      thresholds: { minOptimalHours: 150, maxOptimalHours: 180 },
    };
    const updatedState = makeAppState({ config: updatedConfig });
    rerender({ state: updatedState });

    const stored = JSON.parse(localStorage.getItem('app-config')!);
    expect(stored).toEqual(updatedConfig);
  });

  it('provides loadPersistedConfig function that reads from localStorage', () => {
    const config: AppConfig = {
      thresholds: { minOptimalHours: 110, maxOptimalHours: 165 },
      workingDaysPerMonth: 23,
      dailyHourExpectation: 8,
      resourceBufferDays: { Bob: { 'August 2026': 3 } },
    };
    localStorage.setItem('app-config', JSON.stringify(config));

    const state = makeAppState();
    const { result } = renderHook(() => usePersistence(state));

    expect(result.current.loadPersistedConfig()).toEqual(config);
  });

  it('provides saveConfig function that writes to localStorage', () => {
    const state = makeAppState();
    const { result } = renderHook(() => usePersistence(state));

    const newConfig: AppConfig = {
      ...DEFAULT_APP_CONFIG,
      workingDaysPerMonth: 25,
    };
    result.current.saveConfig(newConfig);

    const stored = JSON.parse(localStorage.getItem('app-config')!);
    expect(stored).toEqual(newConfig);
  });
});

describe('useFilterPersistence hook', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('does not write to sessionStorage on initial render', () => {
    const filters: FilterState = {
      projects: ['Alpha'],
      resources: [],
      months: [],
      categories: [],
    };
    renderHook(() => useFilterPersistence(filters));

    expect(sessionStorage.getItem('app-filters')).toBeNull();
  });

  it('saves filters to sessionStorage when they change', () => {
    const initialFilters: FilterState = {
      projects: [],
      resources: [],
      months: [],
      categories: [],
    };
    const { rerender } = renderHook(({ filters }) => useFilterPersistence(filters), {
      initialProps: { filters: initialFilters },
    });

    const updatedFilters: FilterState = {
      projects: ['Beta'],
      resources: ['Charlie'],
      months: ['July 2026'],
      categories: ['optimally-utilized'],
    };
    rerender({ filters: updatedFilters });

    const stored = JSON.parse(sessionStorage.getItem('app-filters')!);
    expect(stored).toEqual(updatedFilters);
  });
});
