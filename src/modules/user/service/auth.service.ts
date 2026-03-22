import { Repository } from "typeorm";
import { User, CustomerProfile, Vendor } from "@modules/user/entity";
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { UserType } from "@modules/user/entity/ENUM/enum";
import { CONFIG } from "@config/config";
import { sendEmail } from "./email";
import { accountActivationTemplate } from "./email/templates/accountActivation";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import { logError, logInfo } from "@lib/logger";


export class AuthService {
  constructor(
    private userRepository: Repository<User>,
    // private agencyProfileRepository: Repository<TravelAgencyProfile>,
    private vendorRepository: Repository<Vendor>,
    private customerProfileRepository: Repository<CustomerProfile>
  ) { }

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
    name: string,
    callBackUrl: string
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
            logError(error, 'User registration - Email already in use');
            throw new Error("User already exists");
          }
          logError(error, 'User registration - Validation');
          throw error;
        }
        const hashedPassword = await this.hashPassword(password);
        const verificationToken = this.generateVerificationToken(email);

        // Send verification email
        await sendEmail({
          to: email,
          subject: "Account Activation ",
          html: accountActivationTemplate(name, verificationToken, callBackUrl),
        });
        logInfo(`Verification email sent to ${email}`);

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

        logInfo(`User registered successfully: ${email}, Type: ${userType}`);
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
      logInfo(`Email verified successfully for user: ${decoded.email}`);

      return true;
    } catch (error: any) {
      logError(error, 'Email verification');
      throw new Error(`Email verification failed: ${error.message}`);
    }
  }

  async resendVerificationEmail(email: string, callBackUrl: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ["vendor", "customerProfile"],
    });

    if (!user) {
      logError(new Error(`User not found: ${email}`), 'Resend verification email');
      throw new Error("User not found");
    }

    if (user.isVerified) {
      logError(new Error(`Email already verified: ${email}`), 'Resend verification email');
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
      html: accountActivationTemplate(username as string, newToken, callBackUrl),
    });
    logInfo(`Verification email resent to ${email}`);
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
    if (!user) {
      logError(new Error(`Login failed for email: ${email}`), 'User login');
      throw new AppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS);
    }

    if (user.authProvider !== 'local' || !user.password) {
      throw new AppError(
        "This account uses Google sign-in. Please sign in with Google.",
        401,
        ErrorCodes.INVALID_CREDENTIALS
      );
    }

    if (!(await bcrypt.compare(password, user.password))) {
      logError(new Error(`Login failed for email: ${email}`), 'User login');
      throw new AppError("Invalid email or password", 401, ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!user.isVerified) {
      logError(new Error(`Unverified email login attempt: ${email}`), 'User login');
      throw new AppError("Please verify your email before logging in", 401, ErrorCodes.EMAIL_NOT_VERIFIED);
    }

    if (!CONFIG.jwt.secret) {
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
      CONFIG.jwt.secret as string,
      { expiresIn: "7d" }
    );
    logInfo(`User logged in successfully: ${email}`);
    return {
      token,
    };
  }

  // Reset password using token sent to user's email
  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    if (!token) {
      logError(new Error('Reset token missing'), 'Password reset');
      throw new Error('Reset token is required');
    }
    if (!newPassword || !confirmPassword) {
      throw new Error('New password and confirm password are required');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    let payload: any;
    try {
      if (!CONFIG.jwt.secret) {
        throw new Error('JWT secret is not configured');
      }
      payload = jwt.verify(token, CONFIG.jwt.secret as string) as any;
    } catch (err: any) {
      logError(err, 'Password reset - Invalid token');
      throw new Error('Invalid or expired reset token');
    }

    const email = payload?.email;
    if (!email) {
      throw new Error('Invalid token payload');
    }

    const user = await this.userRepository.findOneBy({ email });
    if (!user) {
      logError(new Error(`User not found for password reset: ${email}`), 'Password reset');
      throw new Error('User not found');
    }

    // Update password
    user.password = await this.hashPassword(newPassword);
    user.isVerified = true;
    await this.userRepository.save(user);
    logInfo(`Password reset successfully for user: ${email}`);

    return { success: true, message: 'Password has been reset successfully' };
  }

  // Google OAuth — verify access token via userinfo endpoint and return JWT
  async googleLoginOrRegister(
    accessToken: string,
    preferredUserType: UserType = UserType.VENDOR
  ): Promise<{ token: string; isNewUser: boolean }> {
    // Fetch user info from Google userinfo endpoint
    let googleUser: { sub: string; email: string; name?: string; picture?: string; email_verified?: boolean };
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Google userinfo responded with ${res.status}`);
      googleUser = await res.json();
    } catch (err: any) {
      logError(err, 'Google OAuth - userinfo fetch');
      throw new AppError('Invalid or expired Google token', 401, ErrorCodes.INVALID_CREDENTIALS);
    }

    if (!googleUser.email) {
      throw new AppError('Could not retrieve email from Google account', 400, ErrorCodes.INVALID_CREDENTIALS);
    }

    const { email, sub: googleId, name: googleName, picture } = googleUser;

    const profileIMAGES = [
      'https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/rabbit.png',
      'https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/lion.png',
      'https://khor-test-uploads.s3.us-east-1.amazonaws.com/uploads/profile_image/cat.png',
    ];

    let existingUser = await this.userRepository.findOne({
      where: [{ googleId }, { email }],
      relations: ['vendor', 'customerProfile'],
    });

    let isNewUser = false;

    if (!existingUser) {
      // New user — create account
      isNewUser = true;
      existingUser = await this.userRepository.manager.transaction(async (em) => {
        const newUser = this.userRepository.create({
          email,
          googleId,
          authProvider: 'google',
          userType: preferredUserType,
          isVerified: true,
        });
        await em.save(User, newUser);

        const displayName = googleName || email.split('@')[0];
        const avatar = picture || profileIMAGES[Math.floor(Math.random() * profileIMAGES.length)];

        if (preferredUserType === UserType.VENDOR) {
          const vendor = this.vendorRepository.create({ user: newUser, username: displayName, profile_picture: avatar });
          await em.save(Vendor, vendor);
        } else {
          const profile = this.customerProfileRepository.create({ user: newUser, username: displayName, profile_picture: avatar });
          await em.save(CustomerProfile, profile);
        }

        logInfo(`New user registered via Google OAuth: ${email}`);
        return newUser;
      });

      // Reload with relations
      existingUser = (await this.userRepository.findOne({
        where: { id: existingUser.id },
        relations: ['vendor', 'customerProfile'],
      }))!;
    } else if (!existingUser.googleId) {
      // Existing email/password user — link Google account
      existingUser.googleId = googleId;
      if (!existingUser.isVerified) existingUser.isVerified = true;
      await this.userRepository.save(existingUser);
      logInfo(`Google account linked for existing user: ${email}`);
    }

    if (!CONFIG.jwt.secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const name =
      existingUser.userType === UserType.VENDOR
        ? existingUser.vendor?.username ?? googleName ?? 'Unknown'
        : existingUser.customerProfile?.username ?? googleName ?? 'Unknown';

    const token = jwt.sign(
      {
        userId: existingUser.id,
        userType: existingUser.userType,
        name,
        vendorId: existingUser.userType === UserType.VENDOR ? existingUser.vendor?.id : undefined,
      },
      CONFIG.jwt.secret as string,
      { expiresIn: '7d' }
    );

    return { token, isNewUser };
  }

  async getCurrentUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["vendor", "customerProfile"],
    });

    if (!user) {
      throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
    }

    const username =
      user.userType === UserType.VENDOR
        ? user.vendor?.username
        : user.customerProfile?.username;

    return {
      userId: user.id,
      email: user.email,
      username: username ?? "Unknown",
      userType: user.userType,
      vendorId: user.userType === UserType.VENDOR ? user.vendor?.id : undefined,
    };
  }
}
