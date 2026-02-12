import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./AppError";
import { ErrorCodes } from "./error-codes";

export const globalErrorHandler = (error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
            code: error.errorCode,
            message: error.message,
        });
    }

    if ((error as FastifyError).validation) {
        return reply.status(400).send({
            code: ErrorCodes.VALIDATION_ERROR,
            message: error.message,
            details: (error as FastifyError).validation,
        });
    }

    request.log.error(error); 
    console.error('Unhandled Error:', error);

    return reply.status(500).send({
        code: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
    });
};
