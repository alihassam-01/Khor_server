import 'tsconfig-paths/register';
import fastify from "fastify";
// import { AppDataSource } from "./config/ormconfig";
import typeormPlugin from './app/plugins/typeorm';
import routes from '@modules/user/routes';
import { config } from '@config/config';

async function startServer() {
  const app = fastify();

  await app.register(import('@fastify/formbody'));

  await app.register(import('@fastify/cors'), {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  });

  app.get('/ping', async (_request, reply) => {
    reply.send({ status: "ok" }); 
  });

  try {
    
    await app.register(typeormPlugin);
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1); 
  }

  try {
    for (const route of routes) {
      await app.register(route, { prefix: "/api" });
    }
  } catch (error) {
    console.error("Error registering routes:", error);
    process.exit(1);  
  }

  app.setErrorHandler((_error, _request, reply) => {
    reply.status(500).send({ message: "Internal Server Error" }); 
  });

  try {
    await app.listen({ port: config.server.port, host: config.server.host });
    console.log(`Server running on http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("Error in startServer:", err);
  process.exit(1);
});
