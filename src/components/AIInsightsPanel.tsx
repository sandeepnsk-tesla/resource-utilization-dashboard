/**
 * AIInsightsPanel component — displays AI-powered insights or appropriate
 * placeholder/error/loading states based on AI provider status.
 *
 * Validates: Requirements 13.1, 13.2, 13.4, 13.5
 */

import { useAppContext } from '../state/AppContext';
import { VALIDATION_LIMITS } from '../constants/validation';
import type { AIInsight } from '../types/ai';

/** Severity sort order: high first, then medium, then low */
const SEVERITY_ORDER: Record<AIInsight['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Tailwind classes for severity badges */
const SEVERITY_BADGE_STYLES: Record<AIInsight['severity'], string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-blue-100 text-blue-800',
};

/** Sort insights by severity (high → medium → low) */
function sortBySeverity(insights: AIInsight[]): AIInsight[] {
  return [...insights].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

/** Renders a single insight card */
function InsightCard({ insight }: { insight: AIInsight }) {
  return (
    <div className="border border-gray-200 rounded-md p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900 truncate">
          {insight.title}
        </h4>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${SEVERITY_BADGE_STYLES[insight.severity]}`}
        >
          {insight.severity}
        </span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-3">{insight.description}</p>
    </div>
  );
}

/** AIInsightsPanel — reads aiInsights and aiStatus from context */
export function AIInsightsPanel() {
  const { state } = useAppContext();
  const { aiInsights, aiStatus } = state;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>

      {/* Loading state */}
      {aiStatus === 'loading' && (
        <div className="flex items-center justify-center py-8">
          <svg
            className="animate-spin h-6 w-6 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading AI insights"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="ml-2 text-sm text-gray-500">Loading insights…</span>
        </div>
      )}

      {/* Error state */}
      {aiStatus === 'error' && (
        <div className="text-center py-8 text-gray-500">
          <p>Unable to retrieve AI insights at this time</p>
        </div>
      )}

      {/* Unavailable / placeholder state */}
      {aiStatus === 'unavailable' && (
        <div className="text-center py-8 text-gray-500">
          <p>Coming Soon — AI-powered insights will appear here</p>
        </div>
      )}

      {/* Idle state with insights available */}
      {aiStatus === 'idle' && aiInsights.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No AI insights available</p>
        </div>
      )}

      {aiStatus === 'idle' && aiInsights.length > 0 && (
        <div className="flex flex-col gap-3">
          {sortBySeverity(aiInsights)
            .slice(0, VALIDATION_LIMITS.MAX_AI_INSIGHTS)
            .map((insight, index) => (
              <InsightCard key={`${insight.title}-${index}`} insight={insight} />
            ))}
        </div>
      )}
    </div>
  );
}

export default AIInsightsPanel;
