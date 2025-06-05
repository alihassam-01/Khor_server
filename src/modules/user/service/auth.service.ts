import { Repository } from "typeorm";
import { User, CustomerProfile } from "@entity/user";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { MailService } from "./mail.service";
import { UserType } from "../entity/ENUM/enum";
import { Vendor } from "@entity/business";

export class AuthService {
  constructor(
    private userRepository: Repository<User>,
    // private agencyProfileRepository: Repository<TravelAgencyProfile>,
    private vendorRepository: Repository<Vendor>,
    private customerProfileRepository: Repository<CustomerProfile>,
    private mailService: MailService
  ) {}

  // Validate if email already exists
  private async validateRegistration(email: string): Promise<void> {
    const existingUser = await this.userRepository.findOneBy({ email });
    if (existingUser) {
      throw new Error(
        JSON.stringify({
          message: "Email already in use",
          code: "EMAIL_IN_USE",
        })
      );
    }
  }

  // Hash password
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Generate verification token
  private generateVerificationToken(email: string): string {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }
    return jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "24h" });
  }

  // Registration logic
  async register(
    email: string,
    password: string,
    userType: UserType,
    name: string
  ): Promise<User> {
    await this.validateRegistration(email);
    const hashedPassword = await this.hashPassword(password);
    const verificationToken = this.generateVerificationToken(email);

    // Send verification email
    await this.mailService.sendVerificationEmail(email, verificationToken);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      userType,
      verificationToken,
      isVerified: false,
    });

    await this.userRepository.save(user);

    // Handling user profile based on type
    if (userType === UserType.TRAVEL_AGENCY) {
      const vendor = this.vendorRepository.create({
        user, // Changed from userId to user
        companyName: name, // Changed to match Vendor entity
      });
      await this.vendorRepository.save(vendor);
    } else {
      const customerProfile = this.customerProfileRepository.create({
        user, // Changed from userId to user
        username: name,
      });
      await this.customerProfileRepository.save(customerProfile);
    }

    return user;
  }

  // Email verification logic
  async verifyEmail(token: string): Promise<boolean> {
    try {
      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
        email: string;
      };
      const user = await this.userRepository.findOneBy({
        email: decoded.email,
      });

      if (!user || user.verificationToken !== token) {
        throw new Error("Invalid verification token");
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      await this.userRepository.save(user);

      return true;
    } catch (error: any) {
      throw new Error(`Email verification failed: ${error.message}`);
    }
  }

  // Login logic
  async login(
    email: string,
    password: string
  ): Promise<{
    token: string;
    user: {
      id: string;
      email: string;
      userType: UserType;
      name: string;
    };
  }> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["vendor", "customerProfile"],
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error("Invalid email or password");
    }

    if (!user.isVerified) {
      throw new Error("Please verify your email before logging in");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const name =
      user.userType === UserType.TRAVEL_AGENCY
        ? user.vendor?.companyName ?? "Unknown Agency"
        : user.customerProfile?.username;

    const token = jwt.sign(
      {
        userId: user.id,
        userType: user.userType,
        name: name ?? "Unknown",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        name: name ?? "Unknown",
      },
    };
  }
}
