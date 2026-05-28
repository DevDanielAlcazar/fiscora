import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { PasswordService } from "../modules/auth/password.service.js";

const jwtPluginAsync: FastifyPluginAsync = async (fastify) => {
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_ACCESS_SECRET environment variable is required");
  }

  await fastify.register(jwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: "15m", // Access token expires in 15 minutes
    },
  });

  // Add password verification method to fastify instance
  fastify.decorate("verifyPassword", PasswordService.verifyPassword);
  console.log("✅ verifyPassword method decorated on fastify instance");
};

export const jwtPlugin = fp(jwtPluginAsync, {
  name: "jwt-plugin",
});