import { IsNull, Not } from "typeorm";
import { AppDataSource } from "../../../config/ormconfig";
import { User } from "@entity/user";

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  async createUser(userData: { name: string; email: string }) {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }
  async getUserById(userId: string) {
    const user = await this.userRepository.findOneByOrFail({ id: userId });
    return {
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      userType: user.userType,
      createdAt: user.createdAt,
    };
  }

  async getUsers() {
    const users = await this.userRepository.find({
      relations: {
        customerProfile: true,
        vendor: true,
      },
    });
    // get the customer_profile and vendor

    return users.map((user) => ({
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      userType: user.userType,
      createdAt: user.createdAt,
      profile:
        user.userType === "customer" ? user.customerProfile : user.vendor,
    }));
  }

  async getCustomers() {
    const users = await this.userRepository.find({
      where: {
        isActive: true,
        customerProfile: Not(IsNull()),
      },
      relations: {
        customerProfile: true,
      },
    });
    return users.map((user) => ({
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      customer: user.customerProfile,
      createdAt: user.createdAt,
    }));
  }

  async getVendors() {
    const users = await this.userRepository.find({
      where: {
        isActive: true,
        vendor: { id: Not(IsNull()) },
      },
      relations: {
        vendor: true,
      },
    });

    return users.map((user) => ({
      isActive: user.isActive,
      isVerified: user.isVerified,
      email: user.email,
      vendor: user.vendor,
      createdAt: user.createdAt,
    }));
  }
}
