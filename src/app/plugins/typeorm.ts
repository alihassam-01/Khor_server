import fp from "fastify-plugin";
import { AppDataSource } from "../../config/ormconfig";
import { logError, logInfo } from "../../lib/logger";

export default fp(async () => {
  await AppDataSource.initialize()
  .then(async () => {
    logInfo('Database connection initialized successfully');
    await AppDataSource.query('SELECT 1');
  })
  .catch((err) => {
    logError(err, "TypeORM Data Source initialization");
    process.exit(1);
  });
  await AppDataSource.synchronize();

});
