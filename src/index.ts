import 'tsconfig-paths/register';
import fastify from "fastify";
import typeormPlugin from './app/plugins/typeorm';
import swaggerPlugin from './app/plugins/swagger';
import routes from './modules/user/routes';
import { CONFIG } from './config/config';
import fastifyMultipart from "@fastify/multipart";
import { globalErrorHandler } from './common/errors/global-error-handler';
import { logError, logInfo } from './lib/logger';
import 'dotenv/config';

async function startServer() {
  const allowedOrigins = new Set([
    CONFIG.web_domain.url as string,
    CONFIG.admin_domain.url as string,
    CONFIG.partner_domain.url as string,
    "http://localhost:9010",
    "http://localhost:9002",
    "http://localhost:9014",
    "http://127.0.0.1:9010",
    "http://127.0.0.1:9002",
    "http://127.0.0.1:9014",
    "http://[::1]:9010",
    "http://[::1]:9002",
    "http://[::1]:9014",
    "http://::1:9010",
    "http://::1:9002",
    "http://::1:9014",
  ].filter(Boolean));

  const app = fastify({
    pluginTimeout: 120000,
    logger: true,
    bodyLimit: 50 * 1024 * 1024,
  });

  await app.register(fastifyMultipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: CONFIG.r2.maxFileSize,
      fieldSize: CONFIG.r2.maxFileSize,
      files: 20,
      parts: 100,
    }
  });
  await app.register(import('@fastify/formbody'));

  await app.register(import('@fastify/cors'), {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      try {
        const parsed = new URL(origin);
        const isLoopbackHost = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(parsed.hostname);
        const isAllowedLoopbackPort = ["9010", "9002", "9014"].includes(parsed.port);
        callback(null, isLoopbackHost && isAllowedLoopbackPort);
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  app.get('/ping', async (_request, reply) => {
    reply.send({ status: "ok" });
  });

  try {
    await app.register(swaggerPlugin);
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

  // Initialize background jobs
  try {
    const { initJobs } = await import('./modules/user/jobs');
    initJobs();
  } catch (error) {
    logError(error, "Jobs initialization");
  }

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

