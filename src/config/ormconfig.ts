import { join } from "path";
import { DataSource } from "typeorm";
import { config } from "./config";

const isProduction = process.env.NODE_ENV === "production";

// For production, we need to use the compiled JS files
const entities = isProduction
  ? [
    join(__dirname, "../../src/modules/user/entity/user/*.js"),
    join(__dirname, "../../src/modules/user/entity/article/*.js"),
    join(__dirname, "../../src/modules/user/entity/location/*.js"),
    join(__dirname, "../../src/modules/user/entity/media/*.js"),
    join(__dirname, "../../src/modules/user/entity/room/*.js"), // RoomTypeServiceOption excluded
    join(__dirname, "../../src/modules/user/entity/property/*.js"), // Hotel, Car excluded
    join(__dirname, "../../src/modules/user/entity/business/*.js"), // BusinessVerification excluded
    join(__dirname, "../../src/modules/user/entity/meal/*.js"),
    join(__dirname, "../../src/modules/user/entity/review/*.js"),
    join(__dirname, "../../src/modules/user/entity/address/*.js"), // Locality excluded
    join(__dirname, "../../src/modules/user/entity/bookings/*.js"),
    join(__dirname, "../../src/modules/user/entity/images/*.js"),
    join(__dirname, "../../src/modules/user/entity/payout/*.js"),
  ]
  : [
    // Development: use TypeScript files with relative paths
    join(__dirname, "../../src/modules/user/entity/user/*.ts"),
    join(__dirname, "../../src/modules/user/entity/article/*.ts"),
    join(__dirname, "../../src/modules/user/entity/location/*.ts"),
    join(__dirname, "../../src/modules/user/entity/media/*.ts"),
    join(__dirname, "../../src/modules/user/entity/room/*.ts"), // RoomTypeServiceOption excluded
    join(__dirname, "../../src/modules/user/entity/property/*.ts"), // Hotel, Car excluded
    join(__dirname, "../../src/modules/user/entity/business/*.ts"), // BusinessVerification excluded
    join(__dirname, "../../src/modules/user/entity/meal/*.ts"),
    join(__dirname, "../../src/modules/user/entity/review/*.ts"),
    join(__dirname, "../../src/modules/user/entity/address/*.ts"), // Locality excluded
    join(__dirname, "../../src/modules/user/entity/bookings/*.ts"),
    join(__dirname, "../../src/modules/user/entity/images/*.ts"),
    join(__dirname, "../../src/modules/user/entity/payout/*.ts"),
  ];
export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  // entities: [
  //   User,
  //   CustomerProfile,
  //   Article,
  //   Tag,
  //   ArticleTag,
  //   Location,
  //   LocationAttributes,
  //   LocationCategory,
  //   LocationCategoryMapping,
  //   Media,
  //   RoomInventory,
  //   RoomType,
  //   Property,
  //   Vendor,
  //   Meal,
  //   Review,
  //   BusinessType,
  //   Address,
  //   City,
  //   Booking,
  //   Transactions,
  //   RoomFeature,
  //   ServiceOptions,
  //   Deal,
  //   TourPackage,
  //   Vehicle,
  //   Availability,
  //   Payment,
  //   S3ImagesEntity,
  //   ListingPrice,
  //   Payout,
  //   Refund,
  // ],
  // entities: [__dirname + '/**/*.entity.{ts,js}'],
  entities: entities,

  synchronize: true,
  migrations: ["src/migrations/**/*.ts"],
  logging: true,
  // ssl: true,
  // extra: {
  //   ssl: {
  //     rejectUnauthorized: false,
  //   },
  // },
});
