import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "@modules/user/service/auth.service";
import { UserType } from "@modules/user/entity/ENUM/enum";
import { ILoginDto, IRegisterDto, IResendVerificationEmailDto, IResetPasswordDto, IVerifyEmailQuery, IGoogleVerifyDto } from "@modules/user/dtos/auth.dto";
import { logError } from "@lib/logger";

export class AuthController {
  constructor(private readonly authService: AuthService) { }

  async register(
    req: FastifyRequest<{
      Body: IRegisterDto;
    }>,
    reply: FastifyReply
  ) {
    try {
      const userType = req.body.userType || UserType.CUSTOMER;
      await this.authService.register(
        req.body.email,
        req.body.password,
        userType,
        req.body.name,
        req.body.callBackUrl,
      );
      reply.code(201).send({ message: "Registration successful. Please check your email to verify your account." });
    } catch (error: any) {
      logError(error, 'User registration');
      let parsedError = { message: 'Something went wrong', code: 'UNKNOWN_ERROR' };

      try {
        parsedError = JSON.parse(error.message);
      } catch (_) {
        parsedError.message = error.message;
      }

      reply.code(400).send(parsedError);
    }
  }

  async resendVerificationEmail(
    req: FastifyRequest<{
      Body: IResendVerificationEmailDto;
    }>,
    reply: FastifyReply
  ) {
    try {
      await this.authService.resendVerificationEmail(req.body.email, req.body.callBackUrl);
      reply.send({ message: "Verification email sent successfully" });
    } catch (error: any) {
      logError(error, 'Resend verification email');
      reply.code(400).send({ error: error.message });
    }
  }
  async login(
    req: FastifyRequest<{
      Body: ILoginDto;
    }>,
    reply: FastifyReply
  ) {
    const result = await this.authService.login(req.body.email, req.body.password);
    reply.send(result);
  }

  async verifyEmail(
    req: FastifyRequest<{
      Querystring: IVerifyEmailQuery;
    }>,
    reply: FastifyReply
  ) {
    try {
      const success = await this.authService.verifyEmail(req.query.token);
      if (success) {
        reply.send({ message: "Email verified successfully" });
      } else {
        reply.code(400).send({ error: "Email verification failed" });
      }
    } catch (error: any) {
      logError(error, 'Email verification');
      reply.code(400).send({ error: error.message });
    }
  }

  async resetPassword(
    req: FastifyRequest<{
      Body: IResetPasswordDto;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { token, newPassword, confirmPassword } = req.body;
      if (!token || !newPassword || !confirmPassword) {
        return reply.code(400).send({ error: 'token, newPassword and confirmPassword are required' });
      }

      const result = await this.authService.resetPassword(token, newPassword, confirmPassword);
      reply.send(result);
    } catch (error: any) {
      logError(error, 'Password reset');
      reply.code(400).send({ error: error.message });
    }
  }

  async handleGoogleVerify(
    req: FastifyRequest<{
      Body: IGoogleVerifyDto;
    }>,
    reply: FastifyReply
  ) {
    try {
      const { accessToken, userType } = req.body;
      const { UserType } = await import('../entity/ENUM/enum');
      const preferredType = userType === 'customer' ? UserType.CUSTOMER : UserType.VENDOR;
      const result = await this.authService.googleLoginOrRegister(accessToken, preferredType);
      reply.send(result);
    } catch (error: any) {
      logError(error, 'Google OAuth verify');
      reply.code(401).send({ error: error.message });
    }
  }

  async me(req: FastifyRequest, reply: FastifyReply) {
    try {
      const user = await this.authService.getCurrentUser(req.user.userId);
      reply.send(user);
    } catch (error: any) {
      logError(error, 'Get current user');
      reply.code(error.statusCode || 400).send({ error: error.message });
    }
  }
}
