import { join } from "path";
import { DataSource } from "typeorm";
import { CONFIG } from "./config";

const isProduction = process.env.NODE_ENV === "production";
const projectRoot = process.cwd();

const entities = isProduction
  ? [
    join(projectRoot, "dist/modules/user/entity/user/*.js"),
    join(projectRoot, "dist/modules/user/entity/article/*.js"),
    join(projectRoot, "dist/modules/user/entity/location/*.js"),
    join(projectRoot, "dist/modules/user/entity/address/*.js"),
    join(projectRoot, "dist/modules/user/entity/images/*.js"),
    join(projectRoot, "dist/modules/user/entity/listing/*.js"),
    join(projectRoot, "dist/modules/user/entity/booking/*.js"),
    join(projectRoot, "dist/modules/user/entity/review/*.js"),
    join(projectRoot, "dist/modules/user/entity/payment/*.js"),
    join(projectRoot, "dist/modules/user/entity/subscription-plan.entity.js"),
    join(projectRoot, "dist/modules/user/entity/audit-log.entity.js"),
  ]
  : [
    join(projectRoot, "src/modules/user/entity/user/*.ts"),
    join(projectRoot, "src/modules/user/entity/article/*.ts"),
    join(projectRoot, "src/modules/user/entity/location/*.ts"),
    join(projectRoot, "src/modules/user/entity/address/*.ts"),
    join(projectRoot, "src/modules/user/entity/images/*.ts"),
    join(projectRoot, "src/modules/user/entity/listing/*.ts"),
    join(projectRoot, "src/modules/user/entity/booking/*.ts"),
    join(projectRoot, "src/modules/user/entity/review/*.ts"),
    join(projectRoot, "src/modules/user/entity/payment/*.ts"),
    join(projectRoot, "src/modules/user/entity/subscription-plan.entity.ts"),
    join(projectRoot, "src/modules/user/entity/audit-log.entity.ts"),
  ];


const migrations = isProduction
  ? [join(projectRoot, "dist/migrations/*.js")]
  : [join(projectRoot, "src/migrations/**/*.ts")];

const shouldSynchronize = process.env.DB_SYNCHRONIZE === "true";

export const AppDataSource = new DataSource(
  CONFIG.db.url
    ? {
      type: "postgres",
      url: CONFIG.db.url,
      entities: entities,
      synchronize: shouldSynchronize,
      migrations: migrations,
      logging: false,
    }
    : {
      type: "postgres",
      host: CONFIG.db.host,
      port: CONFIG.db.port,
      username: CONFIG.db.username,
      password: CONFIG.db.password,
      database: CONFIG.db.database,
      entities: entities,
      synchronize: shouldSynchronize,
      migrations: migrations,
      logging: false,
    }
);

export default AppDataSource;
