// import { Repository } from "typeorm";
// import { User } from "@entity/user";

import { AppDataSource } from "../../../config/ormconfig";
import { Vendor } from "../entity/business";

// export class VendorService {
//   constructor(private userRepository: Repository<User>) {}

//   async createVendor(vendorData: { name: string; email: string }) {
//     const vendor = this.userRepository.create(vendorData);
//     return await this.userRepository.save(vendor);
//   }
// }


export class VendorService {
  private repo = AppDataSource.getRepository(Vendor);

  create(data: Partial<Vendor>) {
    const vendor = this.repo.create(data);
    return this.repo.save(vendor);
  }

  findByUserId(userId: string) {
    return this.repo.find({ where: { user: { id: userId } }, relations: ['user'] });
  }
}