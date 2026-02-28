import { join } from "path";
import { DataSource } from "typeorm";
import { CONFIG } from "./config";

const isProduction = process.env.NODE_ENV === "production";

// For production, we need to use the compiled JS files
const entities = isProduction
  ? [
    join(__dirname, "../modules/user/entity/user/*.js"),
    join(__dirname, "../modules/user/entity/article/*.js"),
    join(__dirname, "../modules/user/entity/location/*.js"),
    join(__dirname, "../modules/user/entity/media/*.js"),
    join(__dirname, "../modules/user/entity/address/*.js"),
    join(__dirname, "../modules/user/entity/images/*.js"),
    join(__dirname, "../modules/user/entity/business/*.js"),
    join(__dirname, "../modules/user/entity/ads/*.js"),
    join(__dirname, "../modules/user/entity/subscription-plan.entity.js"),
  ]
  : [
    // Development: use TypeScript files with relative paths
    join(__dirname, "../modules/user/entity/user/*.ts"),
    join(__dirname, "../modules/user/entity/article/*.ts"),
    join(__dirname, "../modules/user/entity/location/*.ts"),
    join(__dirname, "../modules/user/entity/media/*.ts"),
    join(__dirname, "../modules/user/entity/address/*.ts"),
    join(__dirname, "../modules/user/entity/images/*.ts"),
    join(__dirname, "../modules/user/entity/business/*.ts"),
    join(__dirname, "../modules/user/entity/ads/*.ts"),
    join(__dirname, "../modules/user/entity/subscription-plan.entity.ts"),
  ];


const migrations = isProduction
  ? [join(__dirname, "../migrations/*.js")]
  : ["src/migrations/**/*.ts"];
  
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
