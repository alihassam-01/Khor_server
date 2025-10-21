import { join } from "path";
import { DataSource } from "typeorm";
import { config } from "./config";

// import { User, CustomerProfile } from "../../src/modules/user/entity/user";
// import {
//   Article,
//   ArticleTag,
//   Tag,
// } from "../../src/modules/user/entity/article";
// import {
//   LocationAttributes,
//   LocationCategory,
//   LocationCategoryMapping,
//   Location,
// } from "../../src/modules/user/entity/location";
// import { Media } from "../../src/modules/user/entity/media/media.entity";

// // Convert all @modules aliases to relative paths
// import {
//   RoomInventory,
//   RoomType,
//   RoomFeature,
// } from "../../src/modules/user/entity/room";
// import {
//   Property,
//   ServiceOptions,
// } from "../../src/modules/user/entity/property";
// import { Vendor, BusinessType } from "../../src/modules/user/entity/business";
// import { Meal } from "../../src/modules/user/entity/meal/meal.entity";
// import { Review } from "../../src/modules/user/entity/review/review.entity";
// import { Address, City } from "../../src/modules/user/entity/address";
// import {
//   Booking,
//   Transactions,
//   Payment,
//   Refund,
// } from "../../src/modules/user/entity/bookings";
// import { Deal } from "../../src/modules/user/entity/bookings/deal.entity";
// import { TourPackage } from "../../src/modules/user/entity/property/tour-package.entity";
// import { Vehicle } from "../../src/modules/user/entity/property/vehicle.entity";
// import { Availability } from "../../src/modules/user/entity/property/availbility.entity";
// import { S3ImagesEntity } from "../../src/modules/user/entity/images/s3Images.entity";
// import { ListingPrice, Payout } from "../../src/modules/user/entity/payout";

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

  synchronize: false,
  migrations: ["src/migrations/**/*.ts"],
  logging: true,
  // ssl: true,
  // extra: {
  //   ssl: {
  //     rejectUnauthorized: false,
  //   },
  // },
});
