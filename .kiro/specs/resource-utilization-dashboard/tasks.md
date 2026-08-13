# Implementation Plan: Resource Utilization Dashboard

## Overview

A client-side React TypeScript SPA that imports Excel timesheet workbooks, parses resource utilization data, and visualizes it through interactive charts and configurable metrics. Built with Vite, React 18, Recharts, SheetJS, Tailwind CSS, and tested with Vitest + fast-check.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize Vite + React + TypeScript project with dependencies
    - Run `npm create vite@latest` with React + TypeScript template
    - Install dependencies: `xlsx`, `recharts`, `react-router-dom`, `tailwindcss`, `postcss`, `autoprefixer`
    - Install dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
    - Configure Tailwind CSS with `tailwind.config.ts` and `postcss.config.js`
    - Configure Vitest in `vite.config.ts` with jsdom environment
    - Set up project directory structure: `src/types/`, `src/parsers/`, `src/logic/`, `src/state/`, `src/components/`, `src/views/`, `src/__tests__/`
    - _Requirements: 1.1, 7.1_

  - [x] 1.2 Define all TypeScript interfaces and data models
    - Create `src/types/index.ts` with all interfaces: `WorkbookMetadata`, `TimesheetEntry`, `TimesheetData`, `AggregatedResourceData`, `AggregatedProjectData`, `AggregatedMonthData`, `ProjectHours`
    - Create `src/types/config.ts` with: `ThresholdConfig`, `BufferConfig`, `AppConfig`, `FilterState`, `UtilizationCategory`
    - Create `src/types/state.ts` with: `AppState`, `AppAction` union type
    - Create `src/types/parser.ts` with: `ParseOptions`, `ParseResult`, `ParseWarning`, `ParseError`, `FilenameMetadata`, `FetchResult`, `SerializationResult`, `DeserializationResult`
    - Create `src/types/ai.ts` with: `AIInsight`, `AIProviderInput`, `AIProvider`
    - Define validation constants in `src/constants/validation.ts`
    - _Requirements: 1.4, 3.1, 3.2, 5.1, 6.1, 13.1, 13.3, 14.1_

- [x] 2. Implement data ingestion layer
  - [x] 2.1 Implement filename parser module
    - Create `src/parsers/filenameParser.ts`
    - Implement `parseFilename(filename: string): FilenameMetadata` that extracts project name, month, and year from `{ProjectName}_{Month}_{Year}.xlsx` convention
    - Handle edge cases: missing parts, invalid month names, non-numeric year
    - Return `isValid: false` for non-conforming filenames
    - _Requirements: 3.4, 3.5_

  - [ ]* 2.2 Write property test for filename parsing round-trip
    - **Property 8: Filename Convention Parsing Round-Trip**
    - Create `src/__tests__/properties/parser.property.test.ts`
    - Generate arbitrary valid project names (non-empty, no underscores), valid month names, and valid 4-digit years
    - Assert that constructing and parsing a filename recovers original values
    - **Validates: Requirements 3.4**

  - [x] 2.3 Implement Excel parser core module
    - Create `src/parsers/excelParserCore.ts`
    - Implement `parseWorkbook(file: File | ArrayBuffer, options?: ParseOptions): Promise<ParseResult>`
    - Use SheetJS (`xlsx`) to read workbook and iterate sheets
    - For each sheet: check header row for required columns (case-insensitive), extract resource name from sheet name (trimmed whitespace)
    - Validate individual rows: skip rows with invalid date or non-numeric hours
    - Enforce file size limit (50 MB), parse timeout (10s)
    - Collect warnings for skipped sheets and rows, errors for invalid format
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3, 3.6_

  - [ ]* 2.4 Write property test for sheet conformance detection
    - **Property 4: Sheet Conformance Detection**
    - Create test in `src/__tests__/properties/parser.property.test.ts`
    - Generate arbitrary header rows with subset of required columns
    - Assert: sheet marked non-conforming iff any required column is missing, missing columns list matches exactly
    - **Validates: Requirements 1.3, 3.2, 3.3**

  - [ ]* 2.5 Write property test for invalid row skipping
    - **Property 13: Invalid Row Skipping Preserves Valid Data**
    - Generate arbitrary mixes of valid and invalid rows
    - Assert: result contains exactly valid rows, warning lists correct row numbers
    - **Validates: Requirements 3.6**

  - [ ]* 2.6 Write property test for resource name whitespace trimming
    - **Property 20: Resource Name Whitespace Trimming**
    - Generate arbitrary strings with leading/trailing whitespace
    - Assert: trimmed name has no leading/trailing whitespace
    - **Validates: Requirements 3.1**

  - [x] 2.7 Implement Google Drive fetcher module
    - Create `src/parsers/googleDriveFetcher.ts`
    - Implement `fetchFromGoogleDrive(url: string, timeoutMs?: number): Promise<FetchResult>`
    - Validate URL against accepted Google Drive patterns
    - Convert sharing link to direct download URL
    - Handle timeout (30s), network errors, and permission errors
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.8 Write property test for Google Drive URL validation
    - **Property 12: Google Drive URL Pattern Validation**
    - Create test in `src/__tests__/properties/validation.property.test.ts`
    - Generate arbitrary URL strings; assert acceptance iff matches expected patterns
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.9 Implement JSON serializer module
    - Create `src/parsers/jsonSerializer.ts`
    - Implement `serialize(data: ParsedWorkbookCollection): SerializationResult`
    - Implement `deserialize(json: string): DeserializationResult`
    - Preserve sheet-to-resource mapping and workbook-to-project-month association
    - Validate schema on deserialization, report specific failing fields
    - Handle empty datasets with metadata preserved
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 2.10 Write property test for serialization round-trip
    - **Property 2: Serialization Round-Trip Preservation**
    - Create `src/__tests__/properties/serialization.property.test.ts`
    - Generate arbitrary valid workbook collections
    - Assert: serialize then deserialize produces field-by-field equivalent data
    - **Validates: Requirements 14.1, 14.2, 14.3**

  - [ ]* 2.11 Write property test for deserialization error reporting
    - **Property 11: Deserialization Error Reporting**
    - Generate JSON with missing/incorrect fields
    - Assert: returns validation error listing specific failing fields, never partial data
    - **Validates: Requirements 14.4**

- [x] 3. Checkpoint - Ensure all data ingestion tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement business logic layer
  - [x] 4.1 Implement utilization classifier module
    - Create `src/logic/utilizationClassifier.ts`
    - Implement `classifyResource(totalHours, thresholds, bufferConfig): ClassificationResult`
    - Calculate effective available hours: (workingDays - bufferDays) × dailyHourExpectation
    - Classify as: under-utilized (hours < min), over-utilized (hours > max), optimally-utilized (min <= hours <= max)
    - Calculate utilization percentage: (totalHours / effectiveAvailableHours) × 100
    - _Requirements: 5.2, 5.3, 5.4, 6.4_

  - [ ]* 4.2 Write property test for utilization classification completeness
    - **Property 1: Utilization Classification Completeness**
    - Create `src/__tests__/properties/classification.property.test.ts`
    - Generate arbitrary valid thresholds (min < max) and non-negative hours
    - Assert: exactly one category returned, deterministic for same inputs
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.8**

  - [ ]* 4.3 Write property test for effective available hours calculation
    - **Property 6: Effective Available Hours Calculation**
    - Generate arbitrary valid working days (1-31), buffer days (0 to workingDays-1), daily hours (1-24)
    - Assert: result equals exactly (workingDays - bufferDays) × dailyHourExpectation
    - **Validates: Requirements 6.4**

  - [ ]* 4.4 Write property test for threshold validation invariant
    - **Property 9: Threshold Validation Invariant**
    - Create `src/__tests__/properties/config.property.test.ts`
    - Generate arbitrary (min, max) pairs
    - Assert: rejected when min >= max, accepted when min < max and both in [0, 744]
    - **Validates: Requirements 5.7**

  - [ ]* 4.5 Write property test for buffer days validation
    - **Property 18: Buffer Days Validation**
    - Generate arbitrary buffer and working day values
    - Assert: rejected when bufferDays >= workingDays, accepted when 0 <= bufferDays < workingDays
    - **Validates: Requirements 6.6**

  - [x] 4.6 Implement aggregation engine module
    - Create `src/logic/aggregationEngine.ts`
    - Implement `aggregateByResource(timesheets): AggregatedResourceData[]` — sums hours per resource per month across all workbooks (case-insensitive name matching)
    - Implement `aggregateByProject(timesheets): AggregatedProjectData[]`
    - Implement `aggregateByMonth(timesheets): AggregatedMonthData[]`
    - _Requirements: 4.2, 8.3, 10.2_

  - [ ]* 4.7 Write property test for cross-project resource aggregation
    - **Property 7: Cross-Project Resource Aggregation**
    - Create `src/__tests__/properties/aggregation.property.test.ts`
    - Generate arbitrary workbooks with overlapping resource names
    - Assert: aggregated total hours equals sum of individual entries for that resource-month
    - **Validates: Requirements 4.2**

  - [x] 4.8 Implement metrics calculator module
    - Create `src/logic/metricsCalculator.ts`
    - Implement `calculateMetrics(timesheets, thresholds, bufferConfigs, previousMonthData?)`: compute average utilization %, over/under counts, available capacity, highest utilized resource
    - Implement trend indicators (up/down/neutral) comparing to previous month
    - Handle ties for highest utilization using alphabetical ordering
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 4.9 Write property test for metrics calculation consistency
    - **Property 10: Metrics Calculation Consistency**
    - Create `src/__tests__/properties/metrics.property.test.ts`
    - Generate sets of 2+ resources with known hours
    - Assert: average utilization, over/under counts, and capacity match formula
    - **Validates: Requirements 12.1**

  - [ ]* 4.10 Write property test for alphabetical tiebreaker
    - **Property 17: Alphabetical Tiebreaker for Highest Utilization**
    - Generate sets with tied highest hours
    - Assert: displayed resource is first alphabetically (case-insensitive)
    - **Validates: Requirements 12.6**

  - [x] 4.11 Implement filter engine module
    - Create `src/logic/filterEngine.ts`
    - Implement `applyFilters(data, filters): AggregatedResourceData[]`
    - AND logic between dimensions, OR logic within each dimension
    - Handle empty filter arrays (treat as "all selected")
    - _Requirements: 11.2, 11.3_

  - [ ]* 4.12 Write property test for filter AND/OR logic
    - **Property 3: Filter AND/OR Logic Correctness**
    - Create `src/__tests__/properties/filters.property.test.ts`
    - Generate arbitrary datasets and filter combinations
    - Assert: every result satisfies all active dimensions (AND), matches at least one value per dimension (OR), no valid item excluded
    - **Validates: Requirements 11.2, 11.3**

  - [x] 4.13 Implement duplicate project-month detection
    - Create utility in `src/logic/duplicateDetector.ts`
    - Implement check for same project name (case-insensitive) + month-year combination
    - Return conflict info for user prompt
    - _Requirements: 4.5_

  - [ ]* 4.14 Write property test for duplicate project-month detection
    - **Property 19: Duplicate Project-Month Detection**
    - Generate arbitrary workbook pairs with matching/non-matching project-month
    - Assert: conflict detected iff project name (case-insensitive) and month-year match
    - **Validates: Requirements 4.5**

- [x] 5. Checkpoint - Ensure all business logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement state management layer
  - [x] 6.1 Implement AppContext and reducer
    - Create `src/state/AppContext.tsx` with React Context + useReducer
    - Implement reducer handling all `AppAction` types: IMPORT_WORKBOOK, REMOVE_WORKBOOK, UPDATE_THRESHOLDS, UPDATE_WORKING_DAYS, UPDATE_DAILY_HOURS, UPDATE_BUFFER_DAYS, SET_FILTERS, CLEAR_FILTERS, SET_VIEW, SET_AI_INSIGHTS, SET_AI_STATUS
    - On IMPORT_WORKBOOK: add metadata and timesheets to state
    - On REMOVE_WORKBOOK: remove data and trigger recalculation
    - On UPDATE_THRESHOLDS: reclassify all resources immediately
    - Wrap app with AppProvider
    - _Requirements: 4.4, 5.5, 5.8, 6.7, 11.7, 12.2_

  - [x] 6.2 Implement localStorage persistence hooks
    - Create `src/state/usePersistence.ts`
    - Persist config (thresholds, working days, daily hours, buffer days) to localStorage on change
    - Load persisted config on app initialization
    - Persist filter state for session continuity across views
    - _Requirements: 5.5, 6.7, 11.7_

  - [ ]* 6.3 Write property test for configuration persistence round-trip
    - **Property 5: Configuration Persistence Round-Trip**
    - Generate arbitrary valid configs (min < max, working days 1-31, daily hours 1-24, buffer < working)
    - Assert: save to localStorage and load back produces equivalent config
    - **Validates: Requirements 5.5, 6.7**

  - [ ]* 6.4 Write property test for filter state preservation across views
    - **Property 15: Filter State Preservation Across Views**
    - Generate arbitrary filter states and view navigation sequences
    - Assert: filter state unchanged after navigating between views
    - **Validates: Requirements 11.7**

  - [x] 6.5 Implement derived state selectors
    - Create `src/state/selectors.ts`
    - Implement selectors for: filtered data, metrics, aggregated views
    - Memoize expensive computations
    - _Requirements: 11.2, 12.1_

- [x] 7. Checkpoint - Ensure state management tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement presentation layer - Navigation and Layout
  - [x] 8.1 Implement navigation shell and routing
    - Create `src/components/NavigationShell.tsx` with tab-based navigation: Overview | Projects | Resources | Monthly
    - Set up React Router v6 with hash routing
    - Create `src/App.tsx` wrapping with AppProvider and Router
    - Apply Tailwind CSS base layout styles
    - _Requirements: 8.1, 9.1, 10.1_

  - [x] 8.2 Implement filter bar component
    - Create `src/components/FilterBar.tsx`
    - Multi-select dropdowns for: project name, resource name, month ("Month Year" format), utilization category
    - Dynamically populate options from imported data
    - Active filter chips with "x" removal
    - "Clear All Filters" button
    - Dispatch SET_FILTERS / CLEAR_FILTERS actions
    - _Requirements: 11.1, 11.4, 11.5, 11.6_

  - [x] 8.3 Implement configuration panel component
    - Create `src/components/ConfigPanel.tsx`
    - Form inputs for: min/max optimal hours (0-744), working days (1-31), daily hour expectation (1-24)
    - Per-resource buffer days input (0 to workingDays-1)
    - Validate min < max before saving (show inline error)
    - Validate bufferDays < workingDays (show inline error)
    - Dispatch UPDATE_THRESHOLDS, UPDATE_WORKING_DAYS, UPDATE_DAILY_HOURS, UPDATE_BUFFER_DAYS actions
    - Default values: min=140, max=176, workingDays=22, dailyHours=8, bufferDays=0
    - _Requirements: 5.1, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.5, 6.6_

- [x] 9. Implement presentation layer - Data Import UI
  - [x] 9.1 Implement file import component
    - Create `src/components/FileImport.tsx`
    - File picker for local .xlsx/.xls files
    - Google Drive URL input field with validation
    - Progress indicator during parsing
    - Display success/error/warning messages
    - Trigger IMPORT_WORKBOOK action on success
    - Handle duplicate project-month detection with replace/cancel prompt
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 4.5_

  - [x] 9.2 Implement imported data source list component
    - Create `src/components/DataSourceList.tsx`
    - Display table: project name, month, origin (local/Google Drive), file size, resource count, import timestamp
    - Remove button per workbook dispatching REMOVE_WORKBOOK
    - Show up to 20 workbooks
    - _Requirements: 4.1, 4.3, 4.4_

- [x] 10. Implement presentation layer - Charts
  - [x] 10.1 Implement utilization bar chart component
    - Create `src/components/charts/UtilizationBarChart.tsx`
    - Recharts BarChart with resource names on x-axis, hours on y-axis
    - Color-coded bars: red (#E53935) over-utilized, amber (#FFA726) under-utilized, green (#43A047) optimal
    - Tooltip with resource name, hours, category, project breakdown
    - Empty state: "Import timesheet data to view utilization charts"
    - _Requirements: 7.1, 7.4, 7.6_

  - [x] 10.2 Implement distribution donut chart component
    - Create `src/components/charts/DistributionDonutChart.tsx`
    - Recharts PieChart (donut) with three segments for utilization categories
    - Percentage labels on segments, center text showing total resource count
    - _Requirements: 7.2_

  - [ ]* 10.3 Write property test for category distribution percentages
    - **Property 16: Category Distribution Percentages Sum**
    - Generate non-empty sets of classified resources
    - Assert: percentage values for three categories sum to 100% (±0.1%)
    - **Validates: Requirements 7.2**

  - [x] 10.4 Implement trend line chart component
    - Create `src/components/charts/TrendLineChart.tsx`
    - Recharts LineChart showing monthly hours over time
    - Shade optimal threshold band in green
    - Threshold dashed lines (green min, red max)
    - Only render when 2+ months of data available
    - _Requirements: 7.3, 9.4_

  - [x] 10.5 Implement stacked bar chart component
    - Create `src/components/charts/StackedBarChart.tsx`
    - Months on x-axis, hours on y-axis, stack segments per resource color-coded by category
    - _Requirements: 8.4_

  - [x] 10.6 Implement heatmap grid component
    - Create `src/components/charts/HeatmapGrid.tsx`
    - Resources on y-axis, calendar days (1-31) on x-axis
    - Color intensity scale from light (0h) to dark (8+h)
    - Red outline for zero-hour days, gray background for weekends/buffer days
    - _Requirements: 10.3, 10.4_

  - [x] 10.7 Implement horizontal bar chart component
    - Create `src/components/charts/HorizontalBarChart.tsx`
    - Projects on y-axis, hours on x-axis for a selected resource
    - Labels with project name and hours value
    - _Requirements: 9.3_

- [x] 11. Implement presentation layer - Dashboard Views
  - [x] 11.1 Implement Overview view
    - Create `src/views/OverviewView.tsx`
    - Compose: MetricsPanel, UtilizationBarChart, DistributionDonutChart, TrendLineChart
    - Connect to AppContext for filtered/aggregated data
    - Handle empty states
    - _Requirements: 7.1, 7.2, 7.3, 7.6, 12.1_

  - [x] 11.2 Implement Projects view
    - Create `src/views/ProjectsView.tsx`
    - Project selector dropdown
    - Data table: resource name, monthly hours, task count, category badge
    - Summary card: total project hours, active resources, avg utilization %, project timeline
    - StackedBarChart and month-over-month trend line
    - Empty state: "No resource data available for this project"
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 11.3 Implement Resources view
    - Create `src/views/ResourcesView.tsx`
    - Resource selector dropdown + month selector dropdown
    - Summary card: total hours, projects assigned, category badge, buffer days, effective available hours
    - HorizontalBarChart for per-project hours
    - Trend line chart with threshold bands
    - Single data point message when only 1 month
    - Empty state: "No timesheet data found for [name] in [month]"
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 11.4 Implement Monthly view
    - Create `src/views/MonthlyView.tsx`
    - Month selector dropdown
    - Summary card: total team hours, total capacity, utilization %, category counts
    - Resource grouping by category (count + names)
    - HeatmapGrid component
    - Empty state: "Import timesheet data to view monthly summaries"
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.5 Implement Metrics Panel component
    - Create `src/components/MetricsPanel.tsx`
    - Display 5 metrics: avg utilization %, over-utilized count, under-utilized count, available capacity hours, highest utilized resource name
    - Trend arrows: green up, red down, gray neutral
    - Hide metrics with message when fewer than 2 resources
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

  - [x] 11.6 Implement AI Insights panel
    - Create `src/components/AIInsightsPanel.tsx`
    - Display "Coming Soon — AI-powered insights will appear here" placeholder when no provider
    - When insights available: display up to 20 insight cards sorted by severity (high → medium → low)
    - Each card: title, description, severity badge
    - Error state: "Unable to retrieve AI insights at this time"
    - _Requirements: 13.1, 13.2, 13.4, 13.5_

  - [ ]* 11.7 Write property test for AI insights severity ordering
    - **Property 14: AI Insights Severity Ordering**
    - Create `src/__tests__/properties/validation.property.test.ts` (append)
    - Generate arbitrary arrays of insights with mixed severities
    - Assert: sorted output has all "high" before "medium" before "low"
    - **Validates: Requirements 13.4**

- [x] 12. Checkpoint - Ensure all component tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration and wiring
  - [x] 13.1 Wire complete import flow end-to-end
    - Connect FileImport → ExcelParserCore → FilenameParser → Validation → AppContext dispatch
    - Connect GoogleDriveFetcher → ExcelParserCore → same flow
    - Ensure imported data flows through aggregation → classification → charts
    - Test with sample Excel files
    - _Requirements: 1.1, 2.1, 4.2, 5.8_

  - [x] 13.2 Wire configuration updates to reclassification
    - Ensure threshold changes trigger immediate reclassification of all resources
    - Ensure buffer day changes recalculate effective available hours
    - Ensure metrics panel updates within 2 seconds of config save
    - _Requirements: 5.8, 6.4, 12.2_

  - [x] 13.3 Wire filter changes to all views
    - Ensure filter selection updates charts, metrics, and tables within 1 second
    - Ensure filter state persists across view navigation
    - Ensure chart tooltip data reflects filtered state
    - _Requirements: 7.5, 11.2, 11.7_

  - [ ]* 13.4 Write integration tests
    - Create `src/__tests__/integration/importFlow.test.ts` — test full local file import flow
    - Create `src/__tests__/integration/configUpdate.test.ts` — test threshold update → reclassification
    - Create `src/__tests__/integration/filterNavigation.test.ts` — test filter + view navigation
    - _Requirements: 1.1, 5.8, 11.7_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript with React 18, Vite, Recharts, SheetJS, Tailwind CSS, Vitest, and fast-check
- All parsing and computation is client-side only — no backend server needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.7", "2.9"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.8", "2.10", "2.11"] },
    { "id": 4, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 5, "tasks": ["4.1", "4.6", "4.11", "4.13"] },
    { "id": 6, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.7", "4.12", "4.14"] },
    { "id": 7, "tasks": ["4.8"] },
    { "id": 8, "tasks": ["4.9", "4.10"] },
    { "id": 9, "tasks": ["6.1"] },
    { "id": 10, "tasks": ["6.2", "6.5"] },
    { "id": 11, "tasks": ["6.3", "6.4"] },
    { "id": 12, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 13, "tasks": ["9.1", "9.2"] },
    { "id": 14, "tasks": ["10.1", "10.2", "10.4", "10.5", "10.6", "10.7"] },
    { "id": 15, "tasks": ["10.3"] },
    { "id": 16, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6"] },
    { "id": 17, "tasks": ["11.7"] },
    { "id": 18, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 19, "tasks": ["13.4"] }
  ]
}
```
