import { FastifyInstance } from "fastify";
import { AuthTokenPayload } from "../modules/auth/auth.types.js";
import { PasswordService } from "../modules/auth/password.service.js";
import { loginSchema } from "@fiscora/validators";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/api/auth/login", {
    handler: async (request, reply) => {
      // Validate request body using loginSchema
      const parseResult = loginSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Datos de entrada inválidos",
            details: parseResult.error.format(),
          },
        });
      }

      const { email, password } = parseResult.data;

      try {
        // Find user by email using the prisma instance from the plugin
        const user = await fastify.prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            name: true,
            role: true,
            organizationId: true,
          },
        });

        // If user doesn't exist or password doesn't match, return generic 401
        if (!user || !(await PasswordService.verifyPassword(user.passwordHash, password))) {
          return reply.code(401).send({
            error: {
              code: "UNAUTHORIZED",
              message: "Credenciales inválidas",
            },
          });
        }

        // Create JWT payload
        const payload: AuthTokenPayload = {
          userId: user.id,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId || undefined,
        };

        // Sign access token
        const accessToken = await fastify.jwt.sign(payload);

        // Return success response
        return {
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };

      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Error interno del servidor",
          },
        });
      }
    },
  });
}