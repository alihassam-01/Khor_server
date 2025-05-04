import { AppDataSource } from "../../../config/ormconfig";
import { User } from "@entity/user";

export class UserService {
  private userRepository = AppDataSource.getRepository(User);

  async createUser(userData: { name: string; email: string }) {
    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  async getUsers() {
    return await this.userRepository.find();
  }
}