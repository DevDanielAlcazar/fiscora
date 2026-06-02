import { FastifyInstance } from "fastify";
import { z } from "zod";

const updateAccessBodySchema = z.object({
  enabled: z.boolean().optional(),
  adminOnly: z.boolean().optional(),
  beta: z.boolean().optional(),
  consumesUsage: z.boolean().optional(),
  allowSingleXml: z.boolean().optional(),
  allowZip: z.boolean().optional(),
});

const updatePlanBodySchema = z.object({
  planKey: z.enum(["ESSENTIAL", "PROFESSIONAL", "CORPORATION", "FORENSIC_AUDITOR"]),
});

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.get("/api/admin/stripe-webhook/status", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const lastEvent = await fastify.prisma.stripeWebhookEvent.findFirst({
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          stripeEventId: true,
          type: true,
          status: true,
          receivedAt: true,
        },
      });

      const [totalEventsLast24h, failedEventsLast24h] = await Promise.all([
        fastify.prisma.stripeWebhookEvent.count({
          where: { receivedAt: { gte: twentyFourHoursAgo } },
        }),
        fastify.prisma.stripeWebhookEvent.count({
          where: {
            receivedAt: { gte: twentyFourHoursAgo },
            status: "FAILED",
          },
        }),
      ]);

      const apiUrl = process.env.API_URL ?? "http://localhost:4016";

      return reply.send({
        webhookUrl: "/api/webhooks/stripe",
        fullWebhookUrl: `${apiUrl}/api/webhooks/stripe`,
        lastEvent,
        totalEventsLast24h,
        failedEventsLast24h,
      });
    },
  });

  fastify.get("/api/admin/modules/access", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const access = await fastify.prisma.planModuleAccess.findMany({
        include: {
          plan: { select: { id: true, key: true, name: true } },
          module: { select: { id: true, key: true, name: true, description: true } },
        },
        orderBy: [{ plan: { key: "asc" } }, { module: { key: "asc" } }],
      });

      return reply.send(access);
    },
  });

  fastify.patch("/api/admin/modules/access/:id", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const { id } = request.params as { id: string };

      const existing = await fastify.prisma.planModuleAccess.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        return reply.code(404).send({
          error: {
            code: "NOT_FOUND",
            message: "El registro de acceso no existe.",
          },
        });
      }

      const parseResult = updateAccessBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const updated = await fastify.prisma.planModuleAccess.update({
        where: { id },
        data: parseResult.data,
        include: {
          plan: { select: { id: true, key: true, name: true } },
          module: { select: { id: true, key: true, name: true, description: true } },
        },
      });

      return reply.send(updated);
    },
  });

  fastify.get("/api/admin/users", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const users = await fastify.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          organizationId: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              name: true,
              accountType: true,
              stripeCustomerId: true,
              subscription: {
                select: {
                  id: true,
                  status: true,
                  stripeSubscriptionId: true,
                  plan: {
                    select: {
                      key: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const result = users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organization: user.organization
          ? {
              id: user.organization.id,
              name: user.organization.name,
              accountType: user.organization.accountType,
              stripeCustomerId: user.organization.stripeCustomerId,
              subscription: user.organization.subscription
                ? {
                    id: user.organization.subscription.id,
                    status: user.organization.subscription.status,
                    stripeSubscriptionId: user.organization.subscription.stripeSubscriptionId,
                    plan: {
                      key: user.organization.subscription.plan.key,
                      name: user.organization.subscription.plan.name,
                    },
                  }
                : null,
            }
          : null,
      }));

      return reply.send(result);
    },
  });

  fastify.get("/api/admin/users/export", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const users = await fastify.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              name: true,
              accountType: true,
              stripeCustomerId: true,
              subscription: {
                select: {
                  status: true,
                  stripeSubscriptionId: true,
                  plan: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.default.Workbook();
      const sheet = workbook.addWorksheet("Usuarios");

      const headers = [
        "Nombre",
        "Email",
        "Rol",
        "Organización",
        "Tipo de cuenta",
        "Plan actual",
        "Estado suscripción",
        "Stripe Subscription ID",
        "Stripe Customer ID",
        "Fecha de registro",
        "Última actualización",
      ];

      sheet.addRow(headers);

      for (const user of users) {
        sheet.addRow([
          user.name,
          user.email,
          user.role,
          user.organization?.name ?? "Sin organización",
          user.organization?.accountType ?? "—",
          user.organization?.subscription?.plan.name ?? "Sin suscripción",
          user.organization?.subscription?.status ?? "—",
          user.organization?.subscription?.stripeSubscriptionId ?? "—",
          user.organization?.stripeCustomerId ?? "—",
          user.createdAt.toISOString(),
          user.updatedAt.toISOString(),
        ]);
      }

      const buffer = await workbook.xlsx.writeBuffer();

      reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      reply.header("Content-Disposition", 'attachment; filename="fiscora-usuarios.xlsx"');
      return reply.send(buffer);
    },
  });

  fastify.patch("/api/admin/users/:userId/plan", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: {
            code: "FORBIDDEN",
            message: "Acceso denegado. Se requiere rol SUPER_ADMIN.",
          },
        });
      }

      const { userId } = request.params as { userId: string };

      const parseResult = updatePlanBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { planKey } = parseResult.data;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Usuario no encontrado." },
        });
      }

      if (!user.organizationId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "El usuario no tiene una organización asociada.",
          },
        });
      }

      const plan = await fastify.prisma.plan.findUnique({
        where: { key: planKey },
        select: { id: true },
      });

      if (!plan) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: `Plan ${planKey} no encontrado.` },
        });
      }

      const isEssential = planKey === "ESSENTIAL";

      const updateData: {
        planId: string;
        status: string;
        stripeSubscriptionId?: string | null;
      } = {
        planId: plan.id,
        status: "active",
      };

      if (isEssential) {
        updateData.stripeSubscriptionId = null;
      }

      await fastify.prisma.subscription.upsert({
        where: { organizationId: user.organizationId },
        update: updateData,
        create: {
          organizationId: user.organizationId,
          planId: plan.id,
          status: "active",
          stripeSubscriptionId: isEssential ? null : undefined,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        },
      });

      fastify.log.info(
        { userId, organizationId: user.organizationId, planKey },
        "Plan changed by admin",
      );

      return reply.send({ ok: true, message: `Plan cambiado a ${planKey} correctamente.` });
    },
  });
}
