import { FastifyInstance } from "fastify";
import { PasswordService } from "../modules/auth/password.service.js";

declare module "fastify" {
  interface FastifyInstance {
    verifyPassword: typeof PasswordService.verifyPassword;
  }
}