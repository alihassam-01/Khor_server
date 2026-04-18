import 'tsconfig-paths/register';
import fastify from "fastify";
import typeormPlugin from './app/plugins/typeorm';
import routes from './modules/user/routes';
import { CONFIG } from './config/config';
import fastifyMultipart from "@fastify/multipart";
import { globalErrorHandler } from './common/errors/global-error-handler';
import { logError, logInfo } from './lib/logger';
import 'dotenv/config';

async function startServer() {
  const app = fastify({
    pluginTimeout: 120000,
    logger: true,
    bodyLimit: 50 * 1024 * 1024,
  });

  await app.register(fastifyMultipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: CONFIG.r2.maxFileSize,
      fieldSize: CONFIG.r2.maxFileSize, // Allow fields (which might contain file data in memory) to be as large as files
      files: 20, // Support batch uploads of up to 20 files
      parts: 100, // Support up to 100 parts per request
    }
  });
  await app.register(import('@fastify/formbody'));

  await app.register(import('@fastify/cors'), {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  app.get('/ping', async (_request, reply) => {
    reply.send({ status: "ok" });
  });

  try {

    await app.register(typeormPlugin, { timeout: 120000 });

    // Log enabled features
    const { logEnabledFeatures } = await import('./config/features.config');
    logEnabledFeatures();
  } catch (error) {
    logError(error, "Database connection");
    process.exit(1);
  }

  try {
    for (const route of routes) {
      await app.register(route, { prefix: "/api" });
    }
  } catch (error) {
    logError(error, "Route registration");
    process.exit(1);
  }

  app.setErrorHandler(globalErrorHandler);

  try {
    await app.listen({ port: CONFIG.server.port, host: CONFIG.server.host });
    logInfo(`Server running on http://${CONFIG.server.host}:${CONFIG.server.port}`);
  } catch (err) {
    logError(err, "Server startup");
    process.exit(1);
  }
}

startServer().catch((err) => {
  logError(err, "startServer function");
  process.exit(1);
});

