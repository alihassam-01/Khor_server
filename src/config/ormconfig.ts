import { DataSource } from "typeorm";
import { User, CustomerProfile } from "@entity/user";
import {config} from "./config"
import { Article, ArticleTag, Tag  } from "@entity/article";
import { LocationAttributes, LocationCategory, LocationCategoryMapping, Location } from "@entity/location";
import {Media} from "@entity/media/media.entity";
import { Package, PackageDiscount, Duration, PackageLocation, Discount  } from "@modules/user/entity/package";
import { RoomInventory, RoomType } from "@modules/user/entity/room";
import { Hotel, Property, Car } from "@modules/user/entity/property";
import { Vendor, BusinessVerification, BusinessType } from "@modules/user/entity/business";
import { Meal } from "@modules/user/entity/meal/meal.entity";
import { Review } from "@modules/user/entity/review/review.entity";
import { Address, City } from "@modules/user/entity/address";
import { BookingItems, Booking, Transactions } from "@modules/user/entity/bookings";
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,

  entities: [User, CustomerProfile, Article, Tag, ArticleTag, Location, LocationAttributes, LocationCategory, LocationCategoryMapping, Media, Package, PackageDiscount, Duration, PackageLocation, RoomInventory, RoomType, Hotel, Property, Car, Vendor, BusinessVerification, Meal, Review, Discount, BusinessType, Address, City, BookingItems, Booking, Transactions], 
  // entities: [__dirname + '/**/*.entity.{ts,js}'],
  synchronize: true, 
  logging: true,
});
