import { FastifyInstance } from "fastify";
import { AuthTokenPayload } from "../modules/auth/auth.types.js";
import { PasswordService } from "../modules/auth/password.service.js";
import { loginSchema, registerSchema } from "@fiscora/validators";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/api/auth/me", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      return reply.send({
        userId: request.user.userId,
        email: request.user.email,
        role: request.user.role,
        organizationId: request.user.organizationId,
      });
    },
  });

  fastify.post("/api/auth/register", {
    handler: async (request, reply) => {
      const parseResult = registerSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "Datos de entrada inválidos",
            details: parseResult.error.format(),
          },
        });
      }

      const { email, password, name, accountType, organizationName } = parseResult.data;

      try {
        const existing = await fastify.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existing) {
          return reply.code(409).send({
            error: {
              code: "CONFLICT",
              message: "El email ya está registrado",
            },
          });
        }

        const passwordHash = await PasswordService.hashPassword(password);

        let userId: string;

        if (accountType === "ORGANIZATION") {
          const orgName = organizationName || "Mi Empresa";

          const result = await fastify.prisma.$transaction(async (tx) => {
            const org = await tx.organization.create({
              data: { name: orgName },
            });

            const user = await tx.user.create({
              data: {
                email,
                passwordHash,
                name,
                role: "ORG_ADMIN",
                organizationId: org.id,
              },
            });

            const essentialPlan = await tx.plan.findUnique({
              where: { key: "ESSENTIAL" },
            });

            if (essentialPlan) {
              await tx.subscription.create({
                data: {
                  organizationId: org.id,
                  planId: essentialPlan.id,
                  status: "active",
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: new Date(
                    new Date().setFullYear(new Date().getFullYear() + 1),
                  ),
                },
              });
            }

            return { userId: user.id };
          });

          userId = result.userId;
        } else {
          const user = await fastify.prisma.user.create({
            data: {
              email,
              passwordHash,
              name,
              role: "ORG_USER",
            },
          });

          userId = user.id;
        }

        const createdUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        });

        return reply.code(201).send({ user: createdUser });
      } catch (error) {
        fastify.log.error(error, "Registration failed");
        return reply.code(500).send({
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Error interno del servidor",
          },
        });
      }
    },
  });

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