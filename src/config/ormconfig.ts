import { DataSource } from "typeorm";
import { User, CustomerProfile } from "@entity/user";
import {config} from "./config"
import { Article, ArticleTag, Tag  } from "@entity/article";
import { LocationAttributes, LocationCategory, LocationCategoryMapping, Location } from "@entity/location";
import {Media} from "@entity/media/media.entity";
// import { Package, PackageDiscount, Duration, PackageLocation, Discount  } from "@modules/user/entity/package";
import { RoomInventory, RoomType, RoomFeature } from "@modules/user/entity/room";
import { Property, ServiceOptions } from "@modules/user/entity/property";
import { Vendor,  BusinessType } from "@modules/user/entity/business";
import { Meal } from "@modules/user/entity/meal/meal.entity";
import { Review } from "@modules/user/entity/review/review.entity";
import { Address, City } from "@modules/user/entity/address";
import {  Booking, Transactions } from "@modules/user/entity/bookings";
import { Deal } from "@modules/user/entity/bookings/deal.entity";
import { TourPackage } from "@modules/user/entity/property/tour-package.entity";
import { Vehicle } from "@modules/user/entity/property/vehicle.entity";
import { Availability } from "@modules/user/entity/property/availbility.entity";
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,

  entities: [User, CustomerProfile, Article, Tag, ArticleTag, Location, LocationAttributes, LocationCategory, LocationCategoryMapping, Media, RoomInventory, RoomType, Property, Vendor, Meal, Review, BusinessType, Address, City, Booking, Transactions, RoomFeature, ServiceOptions, Deal, TourPackage, Vehicle, Availability], 
  // entities: [__dirname + '/**/*.entity.{ts,js}'],
  synchronize: true, 
  logging: true,
});
