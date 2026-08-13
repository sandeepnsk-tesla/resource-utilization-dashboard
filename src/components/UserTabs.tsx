/**
 * UserTabs Component
 *
 * Displays tabs for each user from the registry.
 * When a tab is clicked, loads that user's Google Sheet data (if not already cached)
 * and dispatches it to the app state so the dashboard shows their data.
 *
 * Features:
 * - Data cached in memory — switching tabs is instant after first load
 * - "Refresh Current" button — re-fetches active user's sheets (bypasses cache)
 * - "Refresh All" button — clears all cache and re-fetches active user
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../state/AppContext';
import { fetchRegistry, fetchUserConfig, loadUserSheets } from '../services/userDataLoader';
import type { UserRegistryEntry, UserConfig } from '../types/users';
import type { UserLoadResult } from '../services/userDataLoader';

interface CachedUserData {
  config: UserConfig;
  loadResult: UserLoadResult;
}

export function UserTabs() {
  const { dispatch } = useAppContext();

  const [registry, setRegistry] = useState<UserRegistryEntry[]>([]);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Cache: userId → loaded data (persists across tab switches)
  const cache = useRef<Map<string, CachedUserData>>(new Map());

  // Fetch registry on mount
  useEffect(() => {
    fetchRegistry()
      .then((reg) => {
        setRegistry(reg.users);
        if (reg.users.length > 0) {
          loadUser(reg.users[0], false);
        }
      })
      .catch((err) => {
        setRegistryError(err instanceof Error ? err.message : 'Failed to load user registry');
      });
  }, []);

  // Load a user's data (optionally force refresh to bypass cache)
  const loadUser = useCallback(async (entry: UserRegistryEntry, forceRefresh: boolean) => {
    setActiveUserId(entry.id);
    setUserError(null);

    // If cached and not forcing refresh, use cache
    if (!forceRefresh && cache.current.has(entry.id)) {
      const cached = cache.current.get(entry.id)!;
      dispatchUserData(cached.loadResult);
      return;
    }

    // Remove from cache if force refreshing
    if (forceRefresh) {
      cache.current.delete(entry.id);
    }

    setLoadingUserId(entry.id);
    try {
      const config = await fetchUserConfig(entry);
      const loadResult = await loadUserSheets(config);

      // Cache the result
      cache.current.set(entry.id, { config, loadResult });
      dispatchUserData(loadResult);

      if (loadResult.errors.length > 0) {
        setUserError(`Some sheets failed to load:\n${loadResult.errors.join('\n')}`);
      }
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoadingUserId(null);
    }
  }, [dispatch]);

  // Clear state and dispatch new user's data
  function dispatchUserData(loadResult: UserLoadResult) {
    dispatch({ type: 'RESET_DATA' });
    dispatch({ type: 'CLEAR_FILTERS' });

    for (let i = 0; i < loadResult.workbooks.length; i++) {
      const metadata = loadResult.workbooks[i];
      const timesheets = loadResult.timesheets.filter(
        (ts) => ts.workbookId === metadata.id
      );
      dispatch({
        type: 'IMPORT_WORKBOOK',
        payload: { metadata, timesheets },
      });
    }
  }

  // Handle tab click
  function handleSelectUser(entry: UserRegistryEntry) {
    loadUser(entry, false);
  }

  // Refresh current user (bypass cache, re-fetch)
  function handleRefreshCurrent() {
    if (!activeUserId) return;
    const entry = registry.find((u) => u.id === activeUserId);
    if (entry) {
      loadUser(entry, true);
    }
  }

  // Refresh all users (clear entire cache, re-fetch current)
  async function handleRefreshAll() {
    cache.current.clear();
    setRefreshingAll(true);

    if (activeUserId) {
      const entry = registry.find((u) => u.id === activeUserId);
      if (entry) {
        await loadUser(entry, true);
      }
    }

    setRefreshingAll(false);
  }

  // Registry loading error
  if (registryError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800 mb-6">
        <p className="font-medium">Failed to load user registry</p>
        <p className="mt-1">{registryError}</p>
      </div>
    );
  }

  if (registry.length === 0) {
    return null;
  }

  const isLoading = loadingUserId !== null;

  return (
    <div className="mb-6">
      {/* User tabs row with refresh buttons */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="User projects">
          {registry.map((user) => {
            const isActive = activeUserId === user.id;
            const isUserLoading = loadingUserId === user.id;

            return (
              <button
                key={user.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectUser(user)}
                disabled={isLoading}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
                  isActive
                    ? 'bg-white text-blue-600 border-gray-200 -mb-px'
                    : 'bg-gray-50 text-gray-600 border-transparent hover:text-gray-800 hover:bg-gray-100'
                } ${isLoading ? 'opacity-70' : ''}`}
              >
                {user.name}
                {isUserLoading && (
                  <span className="ml-2 inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                {cache.current.has(user.id) && !isUserLoading && (
                  <span className="ml-1.5 w-2 h-2 bg-green-400 rounded-full inline-block" title="Data loaded" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Refresh buttons */}
        <div className="flex items-center gap-2 pb-1">
          <button
            onClick={handleRefreshCurrent}
            disabled={isLoading || !activeUserId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Re-fetch current user's sheets"
          >
            <svg className={`w-3.5 h-3.5 ${loadingUserId ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Current
          </button>
          <button
            onClick={handleRefreshAll}
            disabled={isLoading || refreshingAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Clear all cached data and re-fetch current user"
          >
            <svg className={`w-3.5 h-3.5 ${refreshingAll ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh All
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Fetching sheets...
        </div>
      )}

      {/* Error display */}
      {userError && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          <pre className="whitespace-pre-wrap font-sans">{userError}</pre>
        </div>
      )}
    </div>
  );
}
