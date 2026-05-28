import "@fastify/jwt";
import { PasswordService } from "../modules/auth/password.service.js";
import { AuthTokenPayload } from "../modules/auth/auth.types.js";

declare module "fastify" {
  interface FastifyInstance {
    verifyPassword: typeof PasswordService.verifyPassword;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: AuthTokenPayload;
    payload: AuthTokenPayload;
  }
}
