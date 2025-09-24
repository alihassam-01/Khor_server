import { Repository } from "typeorm";
import { User, CustomerProfile } from "../entity/user";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { UserType } from "../entity/ENUM/enum";
import { Vendor } from "../entity/business";
import { config } from "../../../config/config";
import { sendEmail } from "./email";
import { accountActivationTemplate } from "./email/templates/accountActivation";

export class AuthService {
  constructor(
    private userRepository: Repository<User>,
    // private agencyProfileRepository: Repository<TravelAgencyProfile>,
    private vendorRepository: Repository<Vendor>,
    private customerProfileRepository: Repository<CustomerProfile>
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
  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Compare password with hash
  public async comparePassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
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
    const profileIMAGES = [
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/rabbit.png",
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/lion.png",
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/cat.png",
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/chick.png",
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/penguin.png",
      "https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/bear.png",
    ];

    return await this.userRepository.manager.transaction(
      async (transactionalEntityManager) => {
        try {
          await this.validateRegistration(email);
        } catch (error: any) {
          if (error?.message?.includes("EMAIL_IN_USE")) {
            throw new Error("User already exists");
          }
          throw error;
        }
        const hashedPassword = await this.hashPassword(password);
        const verificationToken = this.generateVerificationToken(email);

        // Send verification email
        await sendEmail({
          to: email,
          subject: "Account Activation ",
          html: accountActivationTemplate(name, verificationToken),
        });

        const user = this.userRepository.create({
          email,
          password: hashedPassword,
          userType,
          verificationToken,
          isVerified: false,
        });
        await transactionalEntityManager.save(User, user);

        if (userType === UserType.VENDOR) {
          const vendor = this.vendorRepository.create({
            user,
            username: name,
          });
          vendor.profile_picture =
            profileIMAGES[Math.floor(Math.random() * profileIMAGES.length)];
          await transactionalEntityManager.save(Vendor, vendor);
        } else {
          const customerProfile = this.customerProfileRepository.create({
            username: name,
            user,
            profile_picture:
              profileIMAGES[Math.floor(Math.random() * profileIMAGES.length)],
          });
          await transactionalEntityManager.save(
            CustomerProfile,
            customerProfile
          );
        }

        return user;
      }
    );
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

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepository.findOneBy({ email });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isVerified) {
      throw new Error("Email is already verified");
    }

    const newToken = this.generateVerificationToken(email);
    user.verificationToken = newToken;

    await this.userRepository.save(user);

    const username =
      user.userType === "vendor"
        ? user.vendor?.username
        : user.customerProfile?.username;
    await sendEmail({
      to: email,
      subject: "Account Activation",
      html: accountActivationTemplate(username as string, newToken),
    });
  }

  // Login logic
  async login(
    email: string,
    password: string
  ): Promise<{
    token: string;
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

    if (!config.jwt.secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const name =
      user.userType === UserType.VENDOR
        ? user.vendor?.username ?? "Unknown"
        : user.customerProfile?.username;

    const token = jwt.sign(
      {
        userId: user.id,
        userType: user.userType,
        name: name ?? "Unknown",
        vendorId:
          user.userType === UserType.VENDOR ? user.vendor?.id : undefined,
      },
      config.jwt.secret as string,
      { expiresIn: "7d" }
    );
    return {
      token,
    };
  }
}
