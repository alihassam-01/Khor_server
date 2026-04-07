export const registerSchema = {
    body: {
        type: 'object',
        required: ['email', 'password', 'name'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string', minLength: 2 },
            userType: { type: 'string', enum: ['customer', 'vendor'] },
        },
    },
};

export const loginSchema = {
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
    body: {
        type: 'object',
        required: ['email'],
        properties: {
            email: { type: 'string', format: 'email' },
        },
    },
};

export const resetPasswordSchema = {
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
    body: {
        type: 'object',
        required: ['accessToken'],
        properties: {
            accessToken: { type: 'string' },
            userType: { type: 'string', enum: ['vendor', 'customer'] },
        },
    },
};
