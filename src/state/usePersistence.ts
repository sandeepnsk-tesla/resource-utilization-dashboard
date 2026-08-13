/**
 * Custom hooks for persisting application state to browser storage.
 * - Config (thresholds, working days, daily hours, buffer days) → localStorage
 * - Filter state → sessionStorage (for session continuity across views)
 *
 * Validates: Requirements 5.5, 6.7, 11.7
 */

import { useEffect, useRef, useCallback } from 'react';
import type { AppConfig, FilterState } from '../types/config';
import type { AppState } from '../types/state';
import { DEFAULT_THRESHOLDS, DEFAULT_BUFFER_CONFIG } from '../constants/validation';

/** Storage keys */
const CONFIG_STORAGE_KEY = 'app-config';
const FILTER_STORAGE_KEY = 'app-filters';

/** Default AppConfig used when no persisted config is found or data is corrupted */
export const DEFAULT_APP_CONFIG: AppConfig = {
  thresholds: {
    minOptimalHours: DEFAULT_THRESHOLDS.MIN_OPTIMAL_HOURS,
    maxOptimalHours: DEFAULT_THRESHOLDS.MAX_OPTIMAL_HOURS,
  },
  workingDaysPerMonth: DEFAULT_BUFFER_CONFIG.WORKING_DAYS_PER_MONTH,
  dailyHourExpectation: DEFAULT_BUFFER_CONFIG.DAILY_HOUR_EXPECTATION,
  resourceBufferDays: {},
};

/** Default FilterState used when no persisted filters are found or data is corrupted */
export const DEFAULT_FILTER_STATE: FilterState = {
  projects: [],
  resources: [],
  months: [],
  categories: [],
};

/**
 * Validates that a parsed object has the required shape of AppConfig.
 */
function isValidConfig(parsed: unknown): parsed is AppConfig {
  if (!parsed || typeof parsed !== 'object') return false;

  const obj = parsed as Record<string, unknown>;

  // Validate thresholds
  if (!obj.thresholds || typeof obj.thresholds !== 'object') return false;
  const thresholds = obj.thresholds as Record<string, unknown>;
  if (
    typeof thresholds.minOptimalHours !== 'number' ||
    typeof thresholds.maxOptimalHours !== 'number'
  ) {
    return false;
  }

  // Validate workingDaysPerMonth
  if (typeof obj.workingDaysPerMonth !== 'number') return false;

  // Validate dailyHourExpectation
  if (typeof obj.dailyHourExpectation !== 'number') return false;

  // Validate resourceBufferDays
  if (!obj.resourceBufferDays || typeof obj.resourceBufferDays !== 'object') return false;

  return true;
}

/**
 * Validates that a parsed object has the required shape of FilterState.
 */
function isValidFilters(parsed: unknown): parsed is FilterState {
  if (!parsed || typeof parsed !== 'object') return false;

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.projects)) return false;
  if (!Array.isArray(obj.resources)) return false;
  if (!Array.isArray(obj.months)) return false;
  if (!Array.isArray(obj.categories)) return false;

  return true;
}

/**
 * Loads persisted config from localStorage.
 * Returns the stored AppConfig if valid, or null if not found/corrupted/invalid.
 */
export function loadPersistedConfig(): AppConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw === null) return null;

    const parsed = JSON.parse(raw);
    if (isValidConfig(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    // JSON parse error or localStorage unavailable
    return null;
  }
}

/**
 * Saves the given config to localStorage.
 * Handles cases where localStorage is unavailable (e.g., private browsing) with try/catch.
 */
export function saveConfig(config: AppConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Loads persisted filter state from sessionStorage.
 * Returns the stored FilterState if valid, or null if not found/corrupted/invalid.
 */
export function loadPersistedFilters(): FilterState | null {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw === null) return null;

    const parsed = JSON.parse(raw);
    if (isValidFilters(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    // JSON parse error or sessionStorage unavailable
    return null;
  }
}

/**
 * Saves the given filter state to sessionStorage.
 * Handles cases where sessionStorage is unavailable with try/catch.
 */
export function saveFilters(filters: FilterState): void {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/**
 * Hook that persists app config to localStorage whenever state.config changes.
 * Skips writing on initial mount to avoid overwriting existing persisted data.
 *
 * Also provides utility functions for manual config load/save operations.
 */
export function usePersistence(state: AppState): {
  loadPersistedConfig: () => AppConfig | null;
  saveConfig: (config: AppConfig) => void;
} {
  const isFirstRender = useRef(true);

  // Persist config to localStorage whenever state.config changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveConfig(state.config);
  }, [state.config]);

  const loadConfigFn = useCallback((): AppConfig | null => {
    return loadPersistedConfig();
  }, []);

  const saveConfigFn = useCallback((config: AppConfig): void => {
    saveConfig(config);
  }, []);

  return {
    loadPersistedConfig: loadConfigFn,
    saveConfig: saveConfigFn,
  };
}

/**
 * Hook that persists filter state to sessionStorage whenever filters change.
 * Skips writing on initial mount.
 * This ensures filter continuity when navigating between views within the same session.
 */
export function useFilterPersistence(filters: FilterState): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveFilters(filters);
  }, [filters]);
}

/**
 * Hook variants that accept dispatch for restoring persisted state on mount.
 * Used by AppContext to dispatch individual actions for each config field.
 */
export function useConfigPersistence(
  config: AppConfig,
  dispatch: React.Dispatch<import('../types/state').AppAction>
): void {
  const isFirstRender = useRef(true);
  const hasRestoredRef = useRef(false);

  // On mount: load persisted config and dispatch actions to restore state
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const persisted = loadPersistedConfig();
    if (!persisted) return;

    dispatch({ type: 'UPDATE_THRESHOLDS', payload: persisted.thresholds });
    dispatch({ type: 'UPDATE_WORKING_DAYS', payload: persisted.workingDaysPerMonth });
    dispatch({ type: 'UPDATE_DAILY_HOURS', payload: persisted.dailyHourExpectation });

    // Dispatch buffer days for each resource/month combination
    for (const resourceName of Object.keys(persisted.resourceBufferDays)) {
      const monthMap = persisted.resourceBufferDays[resourceName];
      for (const month of Object.keys(monthMap)) {
        dispatch({
          type: 'UPDATE_BUFFER_DAYS',
          payload: { resourceName, month, days: monthMap[month] },
        });
      }
    }
  }, [dispatch]);

  // Persist config to localStorage on subsequent changes (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveConfig(config);
  }, [config]);
}
