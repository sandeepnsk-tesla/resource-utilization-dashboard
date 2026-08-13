# Requirements Document

## Introduction

A React JS frontend application that reads timesheet data from Excel workbooks (local or Google Drive-linked), visualizes resource utilization through interactive charts, and provides planning metrics. Each Excel workbook represents a project's monthly timesheet, containing multiple sheets named after individual resource engineers with their daily task entries. The system categorizes utilization as over-utilized, under-utilized, or optimally utilized based on configurable hour thresholds, and includes leave/buffer tracking. An AI integration hook is planned for future data insights.

## Glossary

- **Dashboard**: The main React JS frontend application providing visualization and metrics for resource utilization
- **Resource_Engineer**: An individual team member whose timesheet data is tracked in the system
- **Workbook**: An Excel file (.xlsx) representing a single project's monthly timesheet, containing multiple sheets
- **Timesheet_Sheet**: A single sheet within a Workbook, named after a Resource_Engineer, containing daily task entries
- **Utilization_Category**: A classification of a Resource_Engineer's work hours as over-utilized, under-utilized, or optimally utilized
- **Utilization_Threshold**: A configurable set of hour boundaries that define the Utilization_Category ranges
- **Buffer_Days**: Days allocated for leave (casual leave, optional holidays) that reduce the available working days in a month
- **Working_Days**: The total number of business days in a month minus Buffer_Days
- **Data_Source**: The origin of a Workbook, either a local file path or a Google Drive link
- **Parser**: The module responsible for reading and extracting structured data from Excel Workbooks
- **Metrics_Panel**: A UI section displaying the top resource status and planning metrics
- **AI_Integration_Hook**: An extensibility point in the architecture allowing future AI-based insight generation

## Requirements

### Requirement 1: Excel File Import from Local Disk

**User Story:** As a project manager, I want to import Excel timesheet files from my local disk, so that I can visualize resource utilization without requiring internet connectivity.

#### Acceptance Criteria

1. WHEN a user selects a local Excel file (.xlsx or .xls) via the file picker, THE Parser SHALL read all sheets from the Workbook and extract structured timesheet data within 10 seconds for files up to 10 MB
2. IF the selected file is not a valid Excel format (.xlsx or .xls) or is corrupted, THEN THE Parser SHALL display an error message stating "Unsupported file format. Please select a valid .xlsx or .xls file" and not import any data
3. IF a Workbook contains sheets that do not conform to the expected timesheet structure (missing required header columns: date, task description, hours worked, project name, source document link), THEN THE Parser SHALL skip non-conforming sheets and display a warning listing the skipped sheet names with the reason for each skip
4. THE Parser SHALL extract the following fields from each Timesheet_Sheet: date (as ISO 8601 date string), task description (string, max 500 characters), project name (string), source document link (valid URL or empty string), and hours worked (numeric value between 0 and 24 inclusive)
5. IF a selected file exceeds 50 MB, THEN THE Parser SHALL reject the file and display an error message indicating the maximum supported file size is 50 MB
6. IF all sheets in a Workbook are non-conforming, THEN THE Parser SHALL display an error message indicating no valid timesheet data was found in the file

### Requirement 2: Google Drive Excel File Import

**User Story:** As a project manager, I want to import Excel timesheet files from Google Drive via a shared link, so that I can access cloud-stored timesheets directly within the Dashboard.

#### Acceptance Criteria

1. WHEN a user provides a valid Google Drive sharing link (matching pattern https://drive.google.com/file/d/{fileId} or https://docs.google.com/spreadsheets/d/{fileId}) to an Excel file, THE Dashboard SHALL download the file and parse the Workbook using the same extraction logic as local file import
2. IF the Google Drive link does not match the expected URL pattern, THEN THE Dashboard SHALL display an error message stating "Invalid Google Drive link format. Please provide a valid sharing link"
3. IF the Google Drive file is inaccessible due to permission restrictions, THEN THE Dashboard SHALL display an error message stating "File could not be retrieved. Please verify the link has public or shared access enabled"
4. IF the download exceeds 30 seconds or a network error occurs, THEN THE Dashboard SHALL display an error message stating "Download failed due to a network issue. Please check your connection and try again"
5. WHEN a Google Drive file is successfully imported, THE Dashboard SHALL display the file name, import timestamp, and file size in the data source list
6. IF the downloaded file exceeds 50 MB, THEN THE Dashboard SHALL reject the file and display an error message indicating the maximum supported file size is 50 MB

### Requirement 3: Timesheet Data Structure Recognition

**User Story:** As a project manager, I want the system to recognize each sheet in a workbook as a resource engineer's timesheet, so that individual utilization can be tracked per person.

#### Acceptance Criteria

1. THE Parser SHALL treat each sheet name within a Workbook as the Resource_Engineer name, trimming leading and trailing whitespace from the sheet name
2. WHEN parsing a Timesheet_Sheet, THE Parser SHALL identify columns by matching the first row (header row) against the required column names: "Date", "Task Description", "Hours Worked", "Project Name", and "Source Document Link" (case-insensitive matching)
3. IF the header row of a Timesheet_Sheet does not contain all five required column names, THEN THE Parser SHALL mark that sheet as non-conforming and include it in the skip warning with the message "Missing columns: [list of missing column names]"
4. THE Parser SHALL derive the project name and month from the Workbook filename using the convention "{ProjectName}_{Month}_{Year}.xlsx" (e.g., "ProjectAlpha_July_2026.xlsx"), where Month is the full English month name and Year is a 4-digit number
5. IF the Workbook filename does not match the expected convention, THEN THE Parser SHALL prompt the user to manually enter the project name and month for that Workbook
6. WHEN a Timesheet_Sheet contains rows with a null, empty, or non-date value in the Date column, or a null, empty, or non-numeric value in the Hours Worked column, THE Parser SHALL skip those rows and include them in a validation warning summary specifying the row numbers and the reason for skipping

### Requirement 4: Multi-Project Monthly Data Management

**User Story:** As a project manager, I want to manage separate monthly timesheets for multiple projects, so that I can view utilization across different project contexts.

#### Acceptance Criteria

1. THE Dashboard SHALL allow importing up to 20 Workbooks simultaneously, each representing a distinct project-month combination
2. WHEN multiple Workbooks are imported, THE Dashboard SHALL aggregate Resource_Engineer data across all imported Workbooks for cross-project views by summing total hours per Resource_Engineer matched by exact sheet name (case-insensitive)
3. THE Dashboard SHALL display an imported data source list showing project name, month, file origin (local or Google Drive), file size, and number of Resource_Engineers found per Workbook
4. WHEN a user removes a previously imported Workbook, THE Dashboard SHALL recalculate all metrics and charts excluding the removed data within 2 seconds
5. IF a user imports a Workbook with the same project name and month as an already imported Workbook, THEN THE Dashboard SHALL prompt the user to either replace the existing data or cancel the import

### Requirement 5: Configurable Utilization Thresholds

**User Story:** As a project manager, I want to configure hour thresholds that define over-utilization, under-utilization, and optimal utilization, so that the categories reflect my organization's standards.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a configuration panel where users can set the minimum and maximum hour values for optimal utilization per month, accepting integer values between 0 and 744 hours (inclusive)
2. WHEN utilization thresholds are configured, THE Dashboard SHALL classify a Resource_Engineer as under-utilized if total monthly hours fall strictly below the minimum optimal threshold
3. WHEN utilization thresholds are configured, THE Dashboard SHALL classify a Resource_Engineer as over-utilized if total monthly hours exceed the maximum optimal threshold
4. WHEN utilization thresholds are configured, THE Dashboard SHALL classify a Resource_Engineer as optimally utilized if total monthly hours fall within the minimum and maximum optimal thresholds (inclusive)
5. THE Dashboard SHALL persist threshold configuration in browser local storage so values are retained across sessions
6. THE Dashboard SHALL provide default threshold values of 140 hours (minimum) and 176 hours (maximum) for optimal utilization
7. IF the user sets a minimum threshold greater than or equal to the maximum threshold, THEN THE Dashboard SHALL prevent the configuration from being saved and display an error message indicating that the minimum must be less than the maximum
8. WHEN utilization thresholds are updated and saved, THE Dashboard SHALL immediately reclassify all Resource_Engineers according to the new threshold values without requiring a page refresh

### Requirement 6: Buffer and Leave Tracking

**User Story:** As a project manager, I want to account for leave days (casual leave, optional holidays) when calculating utilization, so that the utilization metrics reflect actual available working capacity.

#### Acceptance Criteria

1. THE Dashboard SHALL allow configuring the total Working_Days per month for the organization as a whole number between 1 and 31, with a default value of 22
2. THE Dashboard SHALL allow setting Buffer_Days per Resource_Engineer per month as a whole number from 0 up to the configured Working_Days to account for casual leave, optional holidays, and other non-working days, with a default value of 0
3. THE Dashboard SHALL allow configuring a daily hour expectation as a numeric value between 1 and 24, with a default value of 8 hours
4. WHEN Buffer_Days are configured for a Resource_Engineer, THE Dashboard SHALL calculate the effective available hours as (Working_Days minus Buffer_Days) multiplied by the daily hour expectation, and use this value as the expected capacity when determining the Utilization_Category
5. THE Dashboard SHALL display the effective available hours (Working_Days minus Buffer_Days multiplied by daily hour expectation) alongside actual hours worked for each Resource_Engineer
6. IF a user attempts to set Buffer_Days to a value greater than or equal to the configured Working_Days, THEN THE Dashboard SHALL reject the input and display an error message indicating that Buffer_Days must be less than Working_Days
7. THE Dashboard SHALL persist Working_Days, Buffer_Days, and daily hour expectation configuration in browser local storage so values are retained across sessions

### Requirement 7: Resource Utilization Charts

**User Story:** As a project manager, I want interactive charts showing resource utilization categories, so that I can quickly identify team members who are over-utilized or under-utilized.

#### Acceptance Criteria

1. THE Dashboard SHALL display a bar chart showing each Resource_Engineer's total monthly hours (aggregated across all projects for the selected month) with color coding: red (#E53935) for over-utilized, amber (#FFA726) for under-utilized, and green (#43A047) for optimally utilized
2. THE Dashboard SHALL display a donut chart showing the distribution of Resource_Engineers across the three Utilization_Categories with percentage labels and a center text showing total resource count
3. WHEN data for 2 or more months is imported for the same Resource_Engineer, THE Dashboard SHALL display a trend line chart showing monthly utilization hours over time with the optimal threshold band shaded in green
4. WHEN a user hovers over a chart element, THE Dashboard SHALL display a tooltip within 200ms containing the Resource_Engineer name, total hours, Utilization_Category, and a project breakdown listing each project name with its corresponding hours
5. WHEN a user selects a specific project filter, THE Dashboard SHALL update all charts to reflect only the selected project's data within 1 second
6. WHEN no timesheet data has been imported, THE Dashboard SHALL display an empty state in the charts area with the message "Import timesheet data to view utilization charts"

### Requirement 8: Project-Wise Dashboard View

**User Story:** As a project manager, I want a project-focused dashboard view, so that I can assess utilization and resource allocation for a specific project.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a project-wise view accessible via a "Projects" navigation tab that displays a dropdown to select from all imported project names
2. WHEN a project is selected, THE Dashboard SHALL display a data table listing all Resource_Engineers assigned to that project with columns: Resource_Engineer name, monthly hours worked, number of distinct task descriptions logged, and Utilization_Category badge (color-coded)
3. WHEN a project is selected in the project-wise view, THE Dashboard SHALL display a summary card showing: total project hours consumed (sum of all resource hours), number of active resources (count of Resource_Engineers with hours > 0), average utilization percentage (total hours divided by sum of effective available hours times 100), and project timeline showing the earliest and latest months with imported data
4. THE Dashboard SHALL display a stacked bar chart in the project-wise view with months on the x-axis and hours on the y-axis, where each stack segment represents a Resource_Engineer's contribution, color-coded by their Utilization_Category
5. WHEN data for 2 or more months exists for a project, THE Dashboard SHALL display a line chart showing month-over-month trend of total project hours (left y-axis) and active resource count (right y-axis)
6. WHEN no Resource_Engineers have data for the selected project, THE Dashboard SHALL display an empty state message "No resource data available for this project"

### Requirement 9: Resource-Wise Dashboard View

**User Story:** As a project manager, I want a resource-focused dashboard view, so that I can evaluate an individual resource engineer's workload across all assigned projects.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a resource-wise view accessible via a "Resources" navigation tab that displays a dropdown to select from all imported Resource_Engineer names and a month selector dropdown populated with all months that have data for the selected resource
2. WHEN a Resource_Engineer is selected in the resource-wise view, THE Dashboard SHALL display a summary card showing: total hours worked, number of projects assigned (count of distinct project names), Utilization_Category badge (color-coded), Buffer_Days taken, and effective available hours
3. THE Dashboard SHALL display a horizontal bar chart in the resource-wise view showing hours spent per project for the selected Resource_Engineer in the selected month, with each bar labeled with the project name and hours value
4. WHEN data for 2 or more months exists for a Resource_Engineer, THE Dashboard SHALL display a line chart showing the resource's total monthly hours over time with horizontal threshold bands rendered at the configured minimum (green dashed line) and maximum (red dashed line) optimal threshold values
5. WHEN only 1 month of data exists for a Resource_Engineer, THE Dashboard SHALL display a single data point on the trend chart with a message "Import additional months to view trends"
6. WHEN no data exists for the selected Resource_Engineer in the chosen month, THE Dashboard SHALL display an empty state message "No timesheet data found for [Resource_Engineer name] in [selected month]"

### Requirement 10: Monthly Dashboard View

**User Story:** As a project manager, I want a monthly summary view, so that I can see the overall team utilization status for any given month.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a monthly view accessible via a "Monthly" navigation tab that displays a month selector dropdown populated with all months that have imported data, and a summary of all Resource_Engineers' utilization grouped by Utilization_Category (showing count and list of names per category)
2. WHEN a month is selected in the monthly view, THE Dashboard SHALL display a summary card showing: total team hours worked (sum of all resource hours), total available capacity (sum of all effective available hours), overall utilization percentage (total hours divided by total capacity times 100, rounded to one decimal), and counts per Utilization_Category
3. THE Dashboard SHALL display a heatmap grid in the monthly view with Resource_Engineer names on the y-axis and calendar days (1-31) on the x-axis, where each cell shows the hours logged for that resource on that day using a color intensity scale from light (0 hours) to dark (8+ hours)
4. THE Dashboard SHALL render cells for days with zero hours logged in a distinct red outline in the monthly heatmap, while days that fall on weekends (Saturday, Sunday) or configured Buffer_Days SHALL be rendered with a gray background to distinguish them from missing entries
5. WHEN no data has been imported for any month, THE Dashboard SHALL display an empty state message "Import timesheet data to view monthly summaries"

### Requirement 11: Dashboard Filters

**User Story:** As a project manager, I want comprehensive filtering options across all dashboard views, so that I can drill down into specific subsets of data.

#### Acceptance Criteria

1. THE Dashboard SHALL provide filter controls as multi-select dropdowns for: project name, Resource_Engineer name, month (displayed as "Month Year" format, e.g., "July 2026"), and Utilization_Category, with each dropdown populated dynamically from the currently imported data
2. WHEN one or more filters are applied, THE Dashboard SHALL update all visible charts, metrics, and data tables to reflect only the filtered subset within 1 second of filter selection
3. THE Dashboard SHALL allow combining multiple filters simultaneously using AND logic between filter dimensions (e.g., project AND month) and OR logic within a single filter dimension (e.g., selecting multiple Resource_Engineers shows data for all selected resources)
4. WHEN filters are applied, THE Dashboard SHALL display an active filter summary bar above the main content area showing all currently applied filters as removable chips, where clicking the "x" on a chip removes that individual filter value
5. THE Dashboard SHALL provide a "Clear All Filters" button in the filter summary bar that resets all filter dropdowns to their default unselected state
6. WHEN no data matches the applied filter combination, THE Dashboard SHALL display an empty state message "No results match the current filters" with a suggestion to adjust or clear filters
7. THE Dashboard SHALL persist the current filter state when navigating between dashboard views (project-wise, resource-wise, monthly) within the same session

### Requirement 12: Top Resource Metrics Panel

**User Story:** As a project manager, I want to see the top 5 key metrics for resource status and planning at a glance, so that I can make informed staffing decisions.

#### Acceptance Criteria

1. THE Metrics_Panel SHALL display the following five metrics: average team utilization percentage (total hours divided by total effective available hours times 100, rounded to one decimal), count of over-utilized resources, count of under-utilized resources, total available capacity hours (sum of effective available hours minus actual hours across all resources), and name of the resource with highest total hours worked
2. WHEN a new Workbook is imported or threshold configuration is saved, THE Metrics_Panel SHALL recalculate and update all metric values within 2 seconds
3. WHEN historical data for the previous month is available, THE Metrics_Panel SHALL display each metric with a label, current value, and an arrow indicator: up arrow (green) if the value improved versus previous month, down arrow (red) if it worsened, or a neutral dash (gray) if unchanged
4. WHEN no previous month data is available for comparison, THE Metrics_Panel SHALL display each metric with a label and current value only, without any trend indicator
5. WHEN fewer than two Resource_Engineers have data imported, THE Metrics_Panel SHALL display a message "Import data for at least 2 resources to view meaningful metrics" and hide the metric cards
6. IF multiple Resource_Engineers are tied for highest total hours worked, THEN THE Metrics_Panel SHALL display the one whose name appears first alphabetically

### Requirement 13: AI Integration Extensibility

**User Story:** As a product owner, I want the system architecture to support future AI-based insights, so that intelligent recommendations can be added without significant refactoring.

#### Acceptance Criteria

1. THE Dashboard SHALL expose an AI_Integration_Hook as a TypeScript interface that accepts parsed timesheet data and returns an array of insight objects, each containing: title (string, max 100 characters), description (string, max 500 characters), and severity (enum: "low", "medium", "high")
2. THE Dashboard SHALL include a dedicated "AI Insights" panel in the UI that displays a "Coming Soon — AI-powered insights will appear here" placeholder message when no AI provider is connected
3. THE AI_Integration_Hook SHALL define a standardized data contract specifying the input format (array of objects with: resourceName, projectName, month, totalHours, utilizationCategory, effectiveAvailableHours) and output format (array of insight objects)
4. WHEN an AI provider is connected and returns insights, THE Dashboard SHALL display up to 20 insights in the AI Insights panel sorted by severity (high first, then medium, then low), with each insight rendered as a card showing title, description, and a severity badge
5. IF the AI provider fails to respond within 15 seconds or returns an error, THEN THE Dashboard SHALL display a message "Unable to retrieve AI insights at this time" in the AI Insights panel and continue operating normally without disruption to other features

### Requirement 14: Excel Data Pretty Printing and Round-Trip Validation

**User Story:** As a developer, I want the parsed timesheet data to be serializable back to a structured format and re-parseable without data loss, so that data integrity is verifiable.

#### Acceptance Criteria

1. THE Parser SHALL serialize parsed timesheet data into a JSON representation containing all extracted fields: date (ISO 8601 date string), task (string), hours (number), project name (string), source link (string), resource name (string), and month (string in "Month Year" format)
2. WHEN parsed timesheet data is serialized to JSON and then deserialized back, THE resulting data object SHALL be field-by-field equivalent to the original parsed data, preserving data types (strings remain strings, numbers remain numbers, dates remain ISO 8601 formatted strings)
3. WHEN exporting parsed data as JSON, THE Parser SHALL preserve the original sheet-to-resource mapping and workbook-to-project-month association in the JSON structure using nested objects keyed by project-month and resource name
4. IF deserialization encounters malformed or incomplete JSON (missing required fields or invalid data types), THEN THE Parser SHALL return a validation error listing the specific fields that failed validation rather than silently producing partial data
5. WHEN the parsed timesheet data set is empty (no valid rows extracted), THE Parser SHALL serialize it as an empty JSON object with the workbook metadata (project name, month) preserved
