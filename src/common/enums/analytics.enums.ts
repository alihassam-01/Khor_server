/**
 * Type of an event recorded in `ad_analytics`. Currently `view` and `click`
 * — extend cautiously, this is the cardinality driver for the table.
 */
export enum AnalyticsEventType {
    VIEW = 'view',
    CLICK = 'click',
}
