/**
 * Application state management using React Context + useReducer.
 * Provides centralized state for workbooks, timesheets, configuration,
 * filters, active view, and AI insights.
 */

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, AppAction } from '../types/state';
import { DEFAULT_THRESHOLDS, DEFAULT_BUFFER_CONFIG } from '../constants/validation';

/** Initial application state with default values */
export const initialState: AppState = {
  workbooks: [],
  timesheets: [],
  config: {
    thresholds: {
      minOptimalHours: DEFAULT_THRESHOLDS.MIN_OPTIMAL_HOURS,
      maxOptimalHours: DEFAULT_THRESHOLDS.MAX_OPTIMAL_HOURS,
    },
    workingDaysPerMonth: DEFAULT_BUFFER_CONFIG.WORKING_DAYS_PER_MONTH,
    dailyHourExpectation: DEFAULT_BUFFER_CONFIG.DAILY_HOUR_EXPECTATION,
    resourceBufferDays: {},
  },
  filters: {
    projects: [],
    resources: [],
    months: [],
    categories: [],
  },
  activeView: 'overview',
  aiInsights: [],
  aiStatus: 'unavailable',
};

/** Context value shape: state + dispatch */
interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

/** Reducer handling all AppAction types */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'IMPORT_WORKBOOK':
      return {
        ...state,
        workbooks: [...state.workbooks, action.payload.metadata],
        timesheets: [...state.timesheets, ...action.payload.timesheets],
      };

    case 'REMOVE_WORKBOOK': {
      const { workbookId } = action.payload;
      return {
        ...state,
        workbooks: state.workbooks.filter((wb) => wb.id !== workbookId),
        timesheets: state.timesheets.filter((ts) => ts.workbookId !== workbookId),
      };
    }

    case 'RESET_DATA':
      return {
        ...state,
        workbooks: [],
        timesheets: [],
      };

    case 'UPDATE_THRESHOLDS':
      return {
        ...state,
        config: {
          ...state.config,
          thresholds: action.payload,
        },
      };

    case 'UPDATE_WORKING_DAYS':
      return {
        ...state,
        config: {
          ...state.config,
          workingDaysPerMonth: action.payload,
        },
      };

    case 'UPDATE_DAILY_HOURS':
      return {
        ...state,
        config: {
          ...state.config,
          dailyHourExpectation: action.payload,
        },
      };

    case 'UPDATE_BUFFER_DAYS': {
      const { resourceName, month, days } = action.payload;
      const currentResourceBuffers = state.config.resourceBufferDays[resourceName] ?? {};
      return {
        ...state,
        config: {
          ...state.config,
          resourceBufferDays: {
            ...state.config.resourceBufferDays,
            [resourceName]: {
              ...currentResourceBuffers,
              [month]: days,
            },
          },
        },
      };
    }

    case 'SET_FILTERS':
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload,
        },
      };

    case 'CLEAR_FILTERS':
      return {
        ...state,
        filters: {
          projects: [],
          resources: [],
          months: [],
          categories: [],
        },
      };

    case 'SET_VIEW':
      return {
        ...state,
        activeView: action.payload,
      };

    case 'SET_AI_INSIGHTS':
      return {
        ...state,
        aiInsights: action.payload,
      };

    case 'SET_AI_STATUS':
      return {
        ...state,
        aiStatus: action.payload,
      };

    default:
      return state;
  }
}

/** AppProvider wraps the application with state context */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

/** Hook for consuming app context. Throws if used outside AppProvider. */
export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

/** Hook for consuming only the app state. Throws if used outside AppProvider. */
export function useAppState(): AppState {
  const { state } = useAppContext();
  return state;
}

/** Hook for consuming only the dispatch function. Throws if used outside AppProvider. */
export function useAppDispatch(): React.Dispatch<AppAction> {
  const { dispatch } = useAppContext();
  return dispatch;
}
