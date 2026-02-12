export const registerSchema = {
    body: {
        type: 'object',
        required: ['email', 'password', 'name', 'callBackUrl'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string', minLength: 2 },
            callBackUrl: { type: 'string', format: 'uri' },
            phoneNumber: { type: 'string', nullable: true },
            userType: { type: 'string', enum: ['customer', 'vendor'] }
        }
    }
};

export const loginSchema = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
        }
    }
};

export const resendVerificationEmailSchema = {
    body: {
        type: 'object',
        required: ['email', 'callBackUrl'],
        properties: {
            email: { type: 'string', format: 'email' },
            callBackUrl: { type: 'string', format: 'uri' }
        }
    }
};

export const verifyEmailSchema = {
    querystring: {
        type: 'object',
        required: ['token'],
        properties: {
            token: { type: 'string' }
        }
    }
};

export const resetPasswordSchema = {
    body: {
        type: 'object',
        required: ['token', 'newPassword', 'confirmPassword'],
        properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
            confirmPassword: { type: 'string' }
        }
    }
};
