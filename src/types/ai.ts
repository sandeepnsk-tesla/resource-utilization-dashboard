/**
 * AI integration types for the future AI-powered insights feature.
 * Defines the standardized data contract for AI providers.
 */

import type { UtilizationCategory } from './config';

/** An individual AI-generated insight */
export interface AIInsight {
  title: string;       // max 100 chars
  description: string; // max 500 chars
  severity: 'low' | 'medium' | 'high';
}

/** Input data format for AI providers (standardized data contract) */
export interface AIProviderInput {
  resourceName: string;
  projectName: string;
  month: string;
  totalHours: number;
  utilizationCategory: UtilizationCategory;
  effectiveAvailableHours: number;
}

/** Interface for AI provider implementations */
export interface AIProvider {
  generateInsights(data: AIProviderInput[]): Promise<AIInsight[]>;
}
