import { FastifyInstance } from "fastify";
import { z } from "zod";
import { UsageService } from "../modules/usage/usage.service.js";

const testConsumeBodySchema = z.object({
  moduleKey: z.string().min(1, "moduleKey es requerido"),
  action: z.string().min(1, "action es requerido"),
});

export async function usageRoutes(fastify: FastifyInstance) {
  fastify.get("/api/usage/current", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La cuenta no tiene organización asociada",
          },
        });
      }

      const subscription = await fastify.prisma.subscription.findUnique({
        where: { organizationId: request.user.organizationId },
        select: {
          plan: {
            select: {
              key: true,
              name: true,
              monthlyUsageLimit: true,
            },
          },
        },
      });

      if (!subscription) {
        return reply.code(404).send({
          error: {
            code: "NOT_FOUND",
            message: "No se encontró una suscripción activa",
          },
        });
      }

      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const used = await fastify.prisma.usageEvent.count({
        where: {
          organizationId: request.user.organizationId,
          timestamp: { gte: from, lt: to },
        },
      });

      const limit = subscription.plan.monthlyUsageLimit;
      const unlimited = limit === null;

      return reply.send({
        period: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
        usage: {
          used,
          limit: unlimited ? null : limit,
          remaining: unlimited ? null : limit - used,
          unlimited,
        },
        plan: {
          key: subscription.plan.key,
          name: subscription.plan.name,
        },
      });
    },
  });

  fastify.post("/api/usage/test-consume", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "La cuenta no tiene organización asociada",
          },
        });
      }

      const parseResult = testConsumeBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { moduleKey, action } = parseResult.data;

      try {
        await UsageService.registerUsage({
          prisma: fastify.prisma,
          organizationId: request.user.organizationId,
          userId: request.user.userId,
          moduleKey,
          action,
        });

        return reply.send({
          ok: true,
          message: "Uso registrado correctamente",
        });
      } catch (err) {
        const error = err as Error & { code?: string };

        if (error.code === "USAGE_LIMIT_EXCEEDED") {
          return reply.code(403).send({
            error: {
              code: "USAGE_LIMIT_EXCEEDED",
              message: "Has alcanzado el límite mensual de usos de tu plan.",
            },
          });
        }

        throw err;
      }
    },
  });
}
