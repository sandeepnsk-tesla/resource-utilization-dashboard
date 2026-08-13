/**
 * Application state management types.
 * Defines the shape of global state and all reducer actions.
 */

import type { WorkbookMetadata, TimesheetData } from './index';
import type { AppConfig, FilterState, ThresholdConfig } from './config';
import type { AIInsight } from './ai';

/** AI loading/connection status */
export type AIStatus = 'idle' | 'loading' | 'error' | 'unavailable';

/** Active dashboard view */
export type ActiveView = 'overview' | 'projects' | 'resources' | 'monthly';

/** Full application state shape */
export interface AppState {
  workbooks: WorkbookMetadata[];
  timesheets: TimesheetData[];
  config: AppConfig;
  filters: FilterState;
  activeView: ActiveView;
  aiInsights: AIInsight[];
  aiStatus: AIStatus;
}

/** Union type of all application reducer actions */
export type AppAction =
  | { type: 'IMPORT_WORKBOOK'; payload: { metadata: WorkbookMetadata; timesheets: TimesheetData[] } }
  | { type: 'REMOVE_WORKBOOK'; payload: { workbookId: string } }
  | { type: 'RESET_DATA' }
  | { type: 'UPDATE_THRESHOLDS'; payload: ThresholdConfig }
  | { type: 'UPDATE_WORKING_DAYS'; payload: number }
  | { type: 'UPDATE_DAILY_HOURS'; payload: number }
  | { type: 'UPDATE_BUFFER_DAYS'; payload: { resourceName: string; month: string; days: number } }
  | { type: 'SET_FILTERS'; payload: Partial<FilterState> }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_VIEW'; payload: ActiveView }
  | { type: 'SET_AI_INSIGHTS'; payload: AIInsight[] }
  | { type: 'SET_AI_STATUS'; payload: AIStatus };
