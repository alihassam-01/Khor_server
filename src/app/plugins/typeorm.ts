import fp from "fastify-plugin";
import { AppDataSource } from "../../config/ormconfig";

export default fp(async () => {
  await AppDataSource.initialize()
  .then(async () => {

    await AppDataSource.query('SELECT 1');
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
    process.exit(1);
  });
  await AppDataSource.synchronize();

});
