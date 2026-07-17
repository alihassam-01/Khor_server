export function sanitizePublicListingDTO<T extends Record<string, any>>(dto: T): T {
    if (!dto) return dto;
    const sanitized = { ...dto } as any;
    
    // Remove vendor and subscription details
    delete sanitized.vendor_id;
    delete sanitized.expires_at;
    delete sanitized.paid_at;
    delete sanitized.next_due_date;
    delete sanitized.subscription_type;
    delete sanitized.subscription_status;
    delete sanitized.plan_id;
    delete sanitized.is_paid;
    // Remove exact location data
    delete sanitized.address;
    delete sanitized.latitude;
    delete sanitized.longitude;
    
    // Remove vendor email and map link
    if (sanitized.links && typeof sanitized.links === 'object') {
        sanitized.links = { ...sanitized.links };
        delete sanitized.links.email;
        delete sanitized.links.map_link;
    }
    
    return sanitized as T;
}
