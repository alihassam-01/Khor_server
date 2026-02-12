import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      singleLine: false,
    },
  },
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

export const logError = (error: Error | unknown, context?: string) => {
  if (error instanceof Error) {
    logger.error({
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      context,
    }, `Error occurred${context ? ` in ${context}` : ''}`);
  } else {
    logger.error({ error, context }, `Unknown error occurred${context ? ` in ${context}` : ''}`);
  }
};

export const logInfo = (message: string, data?: any) => {
  logger.info(data || {}, message);
};

export const logWarn = (message: string, data?: any) => {
  logger.warn(data || {}, message);
};

export const logDebug = (message: string, data?: any) => {
  logger.debug(data || {}, message);
};
