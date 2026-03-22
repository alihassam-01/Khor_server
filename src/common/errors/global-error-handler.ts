import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./AppError";
import { ErrorCodes } from "./error-codes";
import { logError } from "@lib/logger";

export const globalErrorHandler = (error: FastifyError | AppError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
        logError(error, `AppError: ${error.errorCode}`);
        return reply.status(error.statusCode).send({
            code: error.errorCode,
            message: error.message,
        });
    }

    if ((error as FastifyError).validation) {
        logError(error, 'Validation Error');
        return reply.status(400).send({
            code: ErrorCodes.VALIDATION_ERROR,
            message: error.message,
            details: (error as FastifyError).validation,
        });
    }

    logError(error, 'Unhandled Error');

    return reply.status(500).send({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
    });
};
