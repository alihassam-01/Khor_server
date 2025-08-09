import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../service/auth.service";
import { UserType } from "../entity/ENUM/enum";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(
    req: FastifyRequest<{
      Body: {
        email: string;
        password: string;
        userType: UserType;
        name: string;
        phoneNumber?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
       await this.authService.register(
        req.body.email,
        req.body.password,
        req.body.userType,
        req.body.name,

      );
      reply.code(201).send({ message: "Registration successful. Please check your email to verify your account." });
    } catch (error: any) {
      let parsedError = { message: 'Something went wrong', code: 'UNKNOWN_ERROR' };

      try {
        parsedError = JSON.parse(error.message);
      } catch (_) {
        parsedError.message = error.message;
      }
    
      reply.code(400).send(parsedError);    }
  }

  async resendVerificationEmail(
    req: FastifyRequest<{
      Body: {
        email: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      await this.authService.resendVerificationEmail(req.body.email);
      reply.send({ message: "Verification email sent successfully" });
    } catch (error: any) {
      reply.code(400).send({ error: error.message });
    }
  }
  async login(
    req: FastifyRequest<{
      Body: {
        email: string;
        password: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const result = await this.authService.login(req.body.email, req.body.password);
      // reply.send({ token: result.token, user: result.user });
      reply.send(result);
    } catch (error: any) {
      reply.code(401).send({ error: error.message });
    }
  }

  async verifyEmail(
    req: FastifyRequest<{
      Querystring: {
        token: string;
      };
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
      reply.code(400).send({ error: error.message });
    }
  }
}