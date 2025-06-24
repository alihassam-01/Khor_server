// import { AppDataSource } from "@config/ormconfig";
// import { BusinessType, Vendor } from "@entity/business";
// import { Car, Hotel, Property } from "@entity/property";
// import { LocationService } from "./location.service";
// import { UserService } from "./user.service";
// import { User } from "@entity/user";
// // import { Location } from "@entity/location";

// export class BusinessService {
//   private businessTypeRepository = AppDataSource.getRepository(BusinessType);
//   private propertyRepository = AppDataSource.getRepository(Property);
//   private vendorRepository = AppDataSource.getRepository(Vendor);
//   private carRepository = AppDataSource.getRepository(Car);
//   private hotelRepository = AppDataSource.getRepository(Hotel);
//   private userRepository = AppDataSource.getRepository(User);
//   // private locationRepository = AppDataSource.getRepository(Location);
//   constructor(
//     private readonly locationService: LocationService,
//     private readonly userService: UserService
//   ) {}

//   async createBusinessType(name: string): Promise<BusinessType> {
//     const newBusinessType = this.businessTypeRepository.create({ name });
//     return await this.businessTypeRepository.save(newBusinessType);
//   }
//   async createBusiness(
//     userUUID: string,
//     businessTypeIds: number[]
//   ): Promise<Property[]> {
//     const vendor = await this.vendorRepository.findOneByOrFail({
//       id: userUUID,
//     });
//     const properties: Property[] = businessTypeIds.map((businessTypeId) =>
//       this.propertyRepository.create({
//         vendor: vendor,
//         businessType: { id: businessTypeId } as BusinessType,
//       })
//     );

//     return await this.propertyRepository.save(properties);
//   }

//   async businessSetup(
//     userUUID: string,
//     businessTypes: string[],
//     CNIC: string,
//     businessName: string,
//     locationId: number,
//     street_address: string,
//     landmark: string,
//     is_primary: boolean
//   ): Promise<Vendor> {
//     const vendor = await this.vendorRepository.findOneByOrFail({
//       id: userUUID,
//     });
//     vendor.cnic = CNIC;
//     vendor.companyName = businessName;
//     await this.vendorRepository.save(vendor);
//     const address = await this.locationService.createAddress(
//       locationId,
//       street_address,
//       landmark,
//       is_primary
//     );
//     // await this.locationRepository.save(address as unknown as Location);
//     const user = await this.userService.getUserById(userUUID);
//     user.addressId = address.address_id;
//     await this.userRepository.save(user);
//     // get type name from businessId
//     for (const businessType of businessTypes) {
//       // const businessType = await this.businessTypeRepository.findOneByOrFail({
//       //   id: businessTypeId,
//       // });
//       switch (businessType) {
//         case "car_rental":
//           const car = new Car();
//           car.vendor = vendor;
//           car.businessType = await this.businessTypeRepository.findOneByOrFail({
//             name: businessType,
//           });
//           await this.carRepository.save(car);
//           break;
//         case "hotel":
//           const hotel = new Hotel();
//           hotel.vendor = vendor;
//           hotel.businessType =
//             await this.businessTypeRepository.findOneByOrFail({
//               name: businessType,
//             });
//           await this.hotelRepository.save(hotel);
//           break;
//         case "tour_operator":
//           break;
//         default:
//           throw new Error(`Unknown business type: ${businessType}`);
//       }
//     }
//     // const properties: Property[] = businessTypeIds.map((businessTypeId) =>
//     //   this.propertyRepository.create({
//     //     vendor: vendor,
//     //     businessType: { id: businessTypeId } as BusinessType,
//     //   })
//     // );

//     // await this.propertyRepository.save(properties);
//     return await this.vendorRepository.save(vendor);
//   }

//   async getBusinessProfile(userUUID: string) :
//    Promise<{
//   businessName: string;
//   properties: Property[];
//   cars: Car[];
//   hotels: Hotel[];
//   locationName?: string;
//   city?: string;

//   }>
//   {
//     console.log(`Fetching business profile for user UUID: ${userUUID}`);

//     const vendor = await this.vendorRepository.findOne({
//       where: {
//         user: {
//           id: userUUID,
//         },
//       },
//       relations: ["user"],
//     });

//     const properties = await this.propertyRepository.find({
//       where: { vendor: { id: userUUID } },
//       relations: ["businessType"],
//     });
//     const cars = await this.carRepository.find({
//       where: { vendor: { id: userUUID } },
//       relations: ["businessType"],
//     });
//     const hotels = await this.hotelRepository.find({
//       where: { vendor: { id: userUUID } },
//       relations: ["businessType"],
//     });
//     const location = await this.locationService.getLocationById(
//       vendor?.user.addressId as number
//     );
//     let city: string | undefined;
//     if (location) {
//       const cityData = await this.locationService.getCityByLocationId(
//         location.location_id
//       );
//       city = cityData ? cityData : undefined;
//     }
//     const locationName = location?.name || undefined;
//     const businessName = vendor?.companyName || "Unknown Business";
//     console.log(`Found location name for user UUID: ${userUUID}`, locationName);
//     return  {
//       businessName,
//       properties,
//       cars,
//       hotels,
//       locationName,
//       city,
//     };
//   }
// }
