export const registerSchema = {
    tags: ['Auth'],
    summary: 'Register a new user',
    body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string', minLength: 2 },
            ownerName: { type: 'string', minLength: 2 },
            businessName: { type: 'string', minLength: 2 },
            phone: { type: 'string', minLength: 7 },
            cityId: { type: 'integer', minimum: 1 },
            userType: { type: 'string', enum: ['customer', 'vendor'] },
        },
    },
};

export const loginSchema = {
    tags: ['Auth'],
    summary: 'Login with email and password',
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
        },
    },
};

export const verifyOtpSchema = {
    tags: ['Auth'],
    summary: 'Verify OTP for email verification',
    body: {
        type: 'object',
        required: ['email', 'otp'],
        properties: {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
        },
    },
};

export const resendOtpSchema = {
    tags: ['Auth'],
    summary: 'Resend OTP for email verification',
    body: {
        type: 'object',
        required: ['email'],
        properties: {
            email: { type: 'string', format: 'email' },
        },
    },
};

export const resetPasswordSchema = {
    tags: ['Auth'],
    summary: 'Reset password using token',
    body: {
        type: 'object',
        required: ['token', 'newPassword', 'confirmPassword'],
        properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
            confirmPassword: { type: 'string' },
        },
    },
};

export const googleVerifySchema = {
    tags: ['Auth'],
    summary: 'Verify Google Login token',
    body: {
        type: 'object',
        required: ['accessToken'],
        properties: {
            accessToken: { type: 'string' },
            userType: { type: 'string', enum: ['vendor', 'customer'] },
        },
    },
};
