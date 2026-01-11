/**
 * Feature Guard Middleware
 * 
 * Provides middleware functions to guard routes based on feature flags.
 * Returns a 503 Service Unavailable error if a feature is disabled.
 * 
 * Usage in route files:
 *   import { createFeatureGuard } from '@/middlewares/feature-guard.middleware';
 *   fastify.addHook('preHandler', createFeatureGuard('properties'));
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { features, FeatureFlags } from '../config/features.config';

/**
 * Creates a feature guard middleware for a specific feature
 * @param feature - The feature to check
 * @returns Fastify hook function
 */
export function createFeatureGuard(feature: keyof FeatureFlags) {
    return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!features[feature]) {
            await reply.status(503).send({
                error: 'Feature Not Available',
                message: `The ${feature} feature is not currently enabled on this server.`,
                code: 'FEATURE_DISABLED',
                feature: feature
            });
            return;
        }
    };
}

/**
 * Checks if a specific feature is enabled and throws if not
 * Useful for service-level checks
 * @param feature - The feature to check
 * @throws Error if feature is disabled
 */
export function requireFeature(feature: keyof FeatureFlags): void {
    if (!features[feature]) {
        throw new Error(`Feature '${feature}' is not enabled`);
    }
}
