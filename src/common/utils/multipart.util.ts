/**
 * Utility to extract plain values from multipart/form-data request bodies
 * Handles the circular reference issue in fastify-multipart parsed fields
 */

export interface FieldTypeConfig {
    [key: string]: 'string' | 'number' | 'boolean' | 'array' | 'json';
}

/**
 * Extracts plain values from multipart form-data fields
 * @param body - The raw multipart body from req.body
 * @param typeConfig - Optional configuration for type conversion
 * @returns Clean object with plain values
 */
export function extractMultipartFields<T = any>(
    body: any,
    typeConfig?: FieldTypeConfig
): T {
    const result: any = {};

    // Extract plain values from all fields
    for (const key in body) {
        const field = body[key];
        
        // Skip if field is undefined or null
        if (field === undefined || field === null) continue;

        // Extract value from multipart field object
        let value: any;
        if (field && typeof field === 'object' && field.type === 'field' && 'value' in field) {
            value = field.value;
        } else {
            value = field;
        }

        // Skip undefined/null/empty string values
        if (value === undefined || value === null || value === '') continue;

        // Apply type conversion if configured
        const fieldType = typeConfig?.[key];
        
        if (fieldType === 'number') {
            const parsed = Number(value);
            result[key] = isNaN(parsed) ? undefined : parsed;
        } else if (fieldType === 'boolean') {
            result[key] = value === 'true' || value === true;
        } else if (fieldType === 'array' || fieldType === 'json') {
            // Try to parse JSON, fallback to comma-separated string
            if (Array.isArray(value)) {
                result[key] = value;
            } else {
                try {
                    result[key] = JSON.parse(value);
                } catch {
                    // Fallback: treat as comma-separated string
                    if (fieldType === 'array') {
                        result[key] = String(value).split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        result[key] = value; // Keep as string if JSON parse fails
                    }
                }
            }
        } else {
            // Default: keep as string
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Helper to determine if a request is multipart/form-data
 */
export function isMultipartRequest(contentType: string | undefined): boolean {
    return (contentType || '').toLowerCase().includes('multipart/form-data');
}
