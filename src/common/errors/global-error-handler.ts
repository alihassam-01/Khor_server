import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./AppError";
import { ErrorCodes } from "./error-codes";
import { logError } from "@lib/logger";

export const globalErrorHandler = (error: FastifyError | AppError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    // Standard response structure
    const response = {
        success: false,
        code: ErrorCodes.INTERNAL_SERVER_ERROR as string,
        message: 'Internal Server Error',
        details: undefined as any,
    };

    if (error instanceof AppError || ('errorCode' in error && 'statusCode' in error)) {
        const appError = error as AppError;
        logError(error, `AppError: ${appError.errorCode}`);
        response.code = appError.errorCode;
        response.message = appError.message;
        return reply.status(appError.statusCode).send(response);
    }

    if ((error as FastifyError).validation) {
        logError(error, 'Validation Error');
        response.code = ErrorCodes.VALIDATION_ERROR;
        response.message = 'Incomplete or invalid data provided';
        response.details = (error as FastifyError).validation;
        return reply.status(400).send(response);
    }

    // TypeORM database errors
    const err = error as any;
    if (err.code === 'ER_DUP_ENTRY' || err.code === '23505') { // MySQL and Postgres duplicate entry codes
        logError(error, 'Duplicate Entry Error');
        response.code = ErrorCodes.CONFLICT;
        response.message = 'A resource with this information already exists';
        return reply.status(409).send(response);
    }

    logError(error, 'Unhandled Error');

    // In production, we might want to hide the exact error message if it's not an AppError
    if (process.env.NODE_ENV === 'development') {
        response.message = error.message;
        response.details = err.stack;
    }

    return reply.status(500).send(response);
};
