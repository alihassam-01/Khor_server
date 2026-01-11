/**
 * Feature Flags Configuration
 * 
 * This module provides a centralized way to enable/disable features in the application.
 * Features can be controlled via environment variables for easy deployment configuration.
 * 
 * Usage:
 *   import { features } from '@/config/features.config';
 *   if (features.properties) { ... }
 */

export interface FeatureFlags {
    articles: boolean;
    properties: boolean;
    bookings: boolean;
    tourPackages: boolean;
    vehicles: boolean;
    locations: boolean;
    reviews: boolean;
    payouts: boolean;
    refunds: boolean;
    listingPrices: boolean;
    tags: boolean;
}

/**
 * Feature flags loaded from environment variables.
 * Phase 1 features (articles, locations, reviews) are enabled by default.
 * All other features are disabled by default and must be explicitly enabled.
 */
export const features: FeatureFlags = {
    // Core features for Phase 1 - enabled by default
    articles: process.env.FEATURE_ARTICLES !== 'false',
    locations: process.env.FEATURE_LOCATIONS !== 'false',  // Required for articles
    reviews: process.env.FEATURE_REVIEWS !== 'false',

    // All other features disabled by default, enable by setting env var to 'true'
    properties: process.env.FEATURE_PROPERTIES === 'true',
    bookings: process.env.FEATURE_BOOKINGS === 'true',
    tourPackages: process.env.FEATURE_TOUR_PACKAGES === 'true',
    vehicles: process.env.FEATURE_VEHICLES === 'true',
    payouts: process.env.FEATURE_PAYOUTS === 'true',
    refunds: process.env.FEATURE_REFUNDS === 'true',
    listingPrices: process.env.FEATURE_LISTING_PRICES === 'true',
    tags: process.env.FEATURE_TAGS === 'true',
};

/**
 * Helper function to check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return features[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
    return Object.entries(features)
        .filter(([_, enabled]) => enabled)
        .map(([feature, _]) => feature);
}

/**
 * Log enabled features on startup
 */
export function logEnabledFeatures(): void {
    const enabled = getEnabledFeatures();
    console.log('🚀 Enabled features:', enabled.join(', '));

    if (enabled.length === 3 && enabled.includes('articles') && enabled.includes('locations') && enabled.includes('reviews')) {
        console.log('📝 Running in Phase 1 mode (Articles + Locations + Reviews)');
    }
}
