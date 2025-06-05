import { Repository } from "typeorm";
import { User } from "@entity/user";

export class VendorService {
  constructor(private userRepository: Repository<User>) {}

  async createVendor(vendorData: { name: string; email: string }) {
    const vendor = this.userRepository.create(vendorData);
    return await this.userRepository.save(vendor);
  }
}
