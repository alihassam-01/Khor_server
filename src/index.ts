import 'tsconfig-paths/register';
import fastify from "fastify";
// import { AppDataSource } from "./config/ormconfig";
// import userRoutes from "./modules/user/user.routes";
import authRoutes from "./modules/user/routes/auth.routes";
import typeormPlugin from "./app/plugins/typeorm";
import locationRoutes from "./modules/user/routes/location.routes";
import articleRoutes from "./modules/user/routes/article.routes";
import businessRoutes from '@modules/user/routes/business.routes';


async function startServer() {
  const app = fastify();

  await app.register(import('@fastify/formbody'));

  await app.register(import('@fastify/cors'), {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    app.register(authRoutes, { prefix: "/api" });
    app.register(locationRoutes, { prefix: "/api" });
    app.register(articleRoutes, { prefix: "/api" });
    app.register(businessRoutes, {prefix: "/api" });
  } catch (error) {
    console.error("Error registering routes:", error);
    process.exit(1);  
  }

  app.setErrorHandler((_error, _request, reply) => {
    reply.status(500).send({ message: "Internal Server Error" }); 
  });

  try {
    await app.listen({ port: 3008 });
    console.log("Server running on http://localhost:3008");
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("Error in startServer:", err);
  process.exit(1);
});
