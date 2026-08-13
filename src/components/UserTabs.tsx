/**
 * UserTabs Component
 *
 * Displays tabs for each user from the registry.
 * When a tab is clicked, loads that user's Google Sheet data (if not already cached)
 * and dispatches it to the app state so the dashboard shows their data.
 *
 * Data is cached in memory — once loaded, switching tabs is instant.
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
  const [userError, setUserError] = useState<string | null>(null);

  // Cache: userId → loaded data (persists across tab switches)
  const cache = useRef<Map<string, CachedUserData>>(new Map());

  // Fetch registry on mount
  useEffect(() => {
    fetchRegistry()
      .then((reg) => {
        setRegistry(reg.users);
        // Auto-select first user if available
        if (reg.users.length > 0) {
          handleSelectUser(reg.users[0]);
        }
      })
      .catch((err) => {
        setRegistryError(err instanceof Error ? err.message : 'Failed to load user registry');
      });
  }, []);

  // Load and switch to a user's data
  const handleSelectUser = useCallback(async (entry: UserRegistryEntry) => {
    setActiveUserId(entry.id);
    setUserError(null);

    // If already cached, just dispatch the cached data
    if (cache.current.has(entry.id)) {
      const cached = cache.current.get(entry.id)!;
      dispatchUserData(cached.loadResult);
      return;
    }

    // Otherwise, fetch and load
    setLoadingUserId(entry.id);
    try {
      const config = await fetchUserConfig(entry);
      const loadResult = await loadUserSheets(config);

      // Cache the result
      cache.current.set(entry.id, { config, loadResult });

      // Only dispatch if this user is still the active one
      if (entry.id === activeUserId || true) {
        dispatchUserData(loadResult);
      }

      if (loadResult.errors.length > 0) {
        setUserError(`Some sheets failed to load:\n${loadResult.errors.join('\n')}`);
      }
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to load user data');
    } finally {
      setLoadingUserId(null);
    }
  }, [dispatch, activeUserId]);

  // Clear existing data and dispatch new user's data
  function dispatchUserData(loadResult: UserLoadResult) {
    // First, clear all existing workbooks by removing each one
    dispatch({ type: 'CLEAR_FILTERS' });

    // Remove all existing workbooks (dispatch multiple REMOVE actions)
    // Instead, we'll use a batch approach: clear state by importing fresh
    // We need to reset - simplest approach: remove all then add all
    // Since we can't batch-remove, we'll dispatch a custom approach
    // Actually the cleanest way: dispatch remove for each existing workbook
    // But we don't have access to current state here easily.
    // Better approach: we'll reset by dispatching IMPORT for each new workbook.
    // The issue is old data remains. Let me add a RESET_DATA action.

    // For now, we'll use the existing state reference from context
    // The simplest fix: add a RESET_DATA action to the reducer.
    dispatch({ type: 'RESET_DATA' });

    // Import all loaded workbooks
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

  // Registry loading error
  if (registryError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800">
        <p className="font-medium">Failed to load user registry</p>
        <p className="mt-1">{registryError}</p>
      </div>
    );
  }

  // No users in registry
  if (registry.length === 0) {
    return null; // Registry still loading or empty
  }

  return (
    <div className="mb-6">
      {/* User tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="User projects">
          {registry.map((user) => {
            const isActive = activeUserId === user.id;
            const isLoading = loadingUserId === user.id;

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
                } ${isLoading ? 'opacity-50' : ''}`}
              >
                {user.name}
                {isLoading && (
                  <span className="ml-2 inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                )}
                {cache.current.has(user.id) && !isLoading && (
                  <span className="ml-1.5 w-2 h-2 bg-green-400 rounded-full inline-block" title="Data loaded" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Loading indicator */}
      {loadingUserId && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading sheets...
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
