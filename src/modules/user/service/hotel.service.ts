// import { AppDataSource } from "../../../config/ormconfig";
// import { Hotel, ServiceOptions } from "@entity/property";
// import { BusinessType, Vendor } from "@entity/business";
// import { RoomType } from "../entity/room";
// import { LocationService } from "./location.service";

// export class HotelService {
//   //   private businessTypeRepository = AppDataSource.getRepository(BusinessType);
//   //   private propertyRepository = AppDataSource.getRepository(Property);
//   //   private vendorRepository = AppDataSource.getRepository(Vendor);
//   private hotelRepository = AppDataSource.getRepository(Hotel);
//   private roomTypeRepository = AppDataSource.getRepository(RoomType);
//   private serviceOptionsRepository =
//     AppDataSource.getRepository(ServiceOptions);
//   constructor(private readonly locationService: LocationService) {}

//   async createRoomType(
//     name: string,
//     basePrice: number,
//     maxOccupancy: number,
//     totalRooms: number,
//     typeDescription: string,
//     propertyId: number
//   ): Promise<RoomType> {
//     const hotel = await this.hotelRepository.findOneByOrFail({
//       property_id: propertyId,
//     });

//     const roomType = this.roomTypeRepository.create({
//       room_type_name: name,
//       room_type_base_price: basePrice,
//       room_type_max_capacity: maxOccupancy,
//       total_rooms: totalRooms,
//       room_type_description: typeDescription,
//       property: hotel,
//     });

//     return await this.roomTypeRepository.save(roomType);
//   }

//   async createServiceOption(
//     name: string,
//     possibleValues: string[],
//     propertyType: string
//   ): Promise<ServiceOptions> {
//     const serviceOption = this.serviceOptionsRepository.create({
//       name,
//       possibleValues,
//       propertyType,
//     });

//     return await this.serviceOptionsRepository.save(serviceOption);
//   }

//   async createHotel(
//     hotelName: string,
//     locationId: number,
//     street_address: string,
//     businessTypeId: number,
//     landmark: string,
//     vendorId: string,
//     is_primary: boolean,
//     markupFileLocation?: string
//   ): Promise<Hotel> {
//     const vendorRepo = AppDataSource.getRepository(Vendor);
//     const businessTypeRepo = AppDataSource.getRepository(BusinessType);
//     const hotelRepo = AppDataSource.getRepository(Hotel);

//     const vendor = await vendorRepo.findOneByOrFail({ id: vendorId });
//     const businessType = await businessTypeRepo.findOneByOrFail({
//       id: businessTypeId,
//     });
//     const address = await this.locationService.createAddress(
//       locationId,
//       street_address,
//       landmark,
//       is_primary
//     );
//     // const hotel = hotelRepo.create({
//     //   hotel_name: hotelName,
//     //   addressId: address.address_id,
//     //   vendor,
//     //   businessType,
//     //   ...(markupFileLocation
//     //     ? { markup_file_location: markupFileLocation }
//     //     : {}),
//     // });
//     const hotel = new Hotel();
//     hotel.hotel_name = hotelName;
//     hotel.addressId = address.address_id;
//     hotel.vendor = vendor;
//     hotel.businessType = businessType;
//     if (markupFileLocation) {
//       hotel.markup_file_location = markupFileLocation;
//     }
//     (hotel as any).property_type = "hotel";
//     // console.log("Hotel object before saving:", hotel);
//     const saved = await hotelRepo.save(hotel);
//     console.log(hotel instanceof Hotel); // should be true

//     console.log("Saved Hotel:", saved);
//     // return await hotelRepo.save(hotel);
//     return saved;
//   }

// //   const async addRoomInventory(
// //     roomTypeId: number,

// }
