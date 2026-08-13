/**
 * App root component.
 * Sets up HashRouter routing and wraps the application with AppProvider.
 * Routes render inside the NavigationShell layout component.
 * Wires persistence hooks for config (localStorage) and filters (sessionStorage).
 *
 * Requirements: 5.5, 5.8, 6.4, 6.7, 8.1, 9.1, 10.1, 11.7, 12.2
 */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useAppContext } from './state/AppContext';
import { useConfigPersistence, useFilterPersistence, loadPersistedFilters } from './state/usePersistence';
import { NavigationShell } from './components/NavigationShell';
import { OverviewView } from './views/OverviewView';
import { ProjectsView } from './views/ProjectsView';
import { ResourcesView } from './views/ResourcesView';
import { MonthlyView } from './views/MonthlyView';

/**
 * Inner component that wires persistence hooks.
 * Must be a child of AppProvider so it has access to context.
 * - useConfigPersistence: persists thresholds, working days, daily hours, buffer days to localStorage on change;
 *   restores from localStorage on mount.
 * - useFilterPersistence: persists filter state to sessionStorage on change.
 * - Restores persisted filter state from sessionStorage on mount.
 */
function PersistenceWiring({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppContext();
  const hasRestoredFilters = useRef(false);

  // Persist config to localStorage and restore on mount
  useConfigPersistence(state.config, dispatch);

  // Restore persisted filters from sessionStorage on mount
  useEffect(() => {
    if (hasRestoredFilters.current) return;
    hasRestoredFilters.current = true;

    const persistedFilters = loadPersistedFilters();
    if (persistedFilters) {
      dispatch({ type: 'SET_FILTERS', payload: persistedFilters });
    }
  }, [dispatch]);

  // Persist filter state to sessionStorage
  useFilterPersistence(state.filters);

  return <>{children}</>;
}

function App() {
  return (
    <AppProvider>
      <PersistenceWiring>
        <HashRouter>
          <Routes>
            <Route element={<NavigationShell />}>
              <Route index element={<OverviewView />} />
              <Route path="projects" element={<ProjectsView />} />
              <Route path="resources" element={<ResourcesView />} />
              <Route path="monthly" element={<MonthlyView />} />
            </Route>
          </Routes>
        </HashRouter>
      </PersistenceWiring>
    </AppProvider>
  );
}

export default App;
