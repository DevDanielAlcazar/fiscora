import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { AuthTokenPayload } from "../modules/auth/auth.types.js";

const authenticatePluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        reply.code(401).send({
          error: {
            code: "UNAUTHORIZED",
            message: "Token de autenticación requerido",
          },
        });
        return;
      }

      const token = authHeader.slice(7);
      const payload = await fastify.jwt.verify<AuthTokenPayload>(token);
      request.user = payload;
    } catch (error) {
      fastify.log.warn(error, "JWT verification failed");
      reply.code(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Token inválido o expirado",
        },
      });
    }
  });
};

export const authenticatePlugin = fp(authenticatePluginAsync, {
  name: "authenticate-plugin",
});
