/**
 * Feature Flags Configuration
 * 
 * This module provides a centralized way to enable/disable features in the application.
 * Features can be controlled via environment variables for easy deployment configuration.
 * 
 * Usage:
 *   import { FEATURES } from '@/config/features.config';
 *   if (FEATURES.articles) { ... }
 */

export interface IFeatureFlags {
    articles: boolean;
    locations: boolean;
    tags: boolean;
}

/**
 * Feature flags loaded from environment variables.
 * Phase 1 features are enabled by default.
 */
export const FEATURES: IFeatureFlags = {
    // Core features for Phase 1 - enabled by default
    articles: process.env.FEATURE_ARTICLES !== 'false',
    locations: process.env.FEATURE_LOCATIONS !== 'false',  // Required for articles and ads
    tags: process.env.FEATURE_TAGS !== 'false',
};

/**
 * Helper function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof IFeatureFlags): boolean {
    return FEATURES[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
    return Object.entries(FEATURES)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature);
}

/**
 * Log enabled features on startup
 */
export function logEnabledFeatures(): void {
    // Enabled features logging removed as requested
}
