export const SUBSCRIPTION_DURATION_DAYS = {
    FREE: 30,
    MONTHLY: 30,
    QUARTERLY: 90,
    YEARLY: 365,
} as const;

export const SUBSCRIPTION_PRICES = {
    FREE: 0,
    MONTHLY: 5000,
    QUARTERLY: 13500,
    YEARLY: 48000,
} as const;

export const FEATURED_AD_PRICE = 2000;

export const DEFAULT_AD_EXPIRATION_DAYS = 30;
