import { FastifyInstance } from "fastify";
import { z } from "zod";
import { PasswordService } from "../modules/auth/password.service.js";

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

const updateUserStatusBodySchema = z.object({
  status: z.enum(["ACTIVE", "BANNED"]),
  reason: z.string().optional(),
});

const createUserBodySchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres"),
  accountType: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
  organizationName: z.string().optional(),
}).refine(
  (data) => data.accountType !== "ORGANIZATION" || (data.organizationName && data.organizationName.length > 0),
  { message: "organizationName es requerido para cuentas ORGANIZATION", path: ["organizationName"] },
);

const updateUserBodySchema = z.object({
  name: z.string().min(1, "El nombre no puede estar vacío").optional(),
  email: z.string().email("Email inválido").optional(),
  organizationName: z.string().min(1, "El nombre de la organización no puede estar vacío").optional(),
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
          status: true,
          bannedAt: true,
          bannedReason: true,
          deletedAt: true,
          deletedReason: true,
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
        status: user.status,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
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
          status: true,
          bannedAt: true,
          bannedReason: true,
          deletedAt: true,
          deletedReason: true,
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
        "Estado usuario",
        "Fecha suspensión",
        "Motivo suspensión",
        "Fecha eliminación",
        "Motivo eliminación",
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
          user.status,
          user.bannedAt?.toISOString() ?? "—",
          user.bannedReason ?? "—",
          user.deletedAt?.toISOString() ?? "—",
          user.deletedReason ?? "—",
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

  fastify.patch("/api/admin/users/:userId/status", {
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

      if (userId === request.user.userId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "No puedes cambiar tu propio estado.",
          },
        });
      }

      const parseResult = updateUserStatusBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { status, reason } = parseResult.data;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Usuario no encontrado." },
        });
      }

      if (status === "BANNED") {
        await fastify.prisma.user.update({
          where: { id: userId },
          data: {
            status: "BANNED",
            bannedAt: new Date(),
            bannedReason: reason ?? null,
          },
        });
      } else {
        await fastify.prisma.user.update({
          where: { id: userId },
          data: {
            status: "ACTIVE",
            bannedAt: null,
            bannedReason: null,
          },
        });
      }

      fastify.log.info({ userId, status, reason }, "User status changed by admin");

      return reply.send({
        ok: true,
        message: status === "BANNED" ? "Usuario suspendido correctamente." : "Usuario reactivado correctamente.",
      });
    },
  });

  fastify.post("/api/admin/users", {
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

      const parseResult = createUserBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { name, email, password, accountType, organizationName } = parseResult.data;

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

      const essentialPlan = await fastify.prisma.plan.findUnique({
        where: { key: "ESSENTIAL" },
      });

      if (!essentialPlan) {
        return reply.code(500).send({
          error: {
            code: "PLAN_NOT_FOUND",
            message: "El plan ESSENTIAL no está configurado. Contacte al administrador.",
          },
        });
      }

      const passwordHash = await PasswordService.hashPassword(password);
      const orgName =
        accountType === "ORGANIZATION" ? organizationName || name : name;

      const result = await fastify.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName, accountType },
        });

        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            name,
            role: "ORG_ADMIN",
            status: "ACTIVE",
            organizationId: org.id,
          },
        });

        await tx.subscription.create({
          data: {
            organizationId: org.id,
            planId: essentialPlan.id,
            status: "active",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          },
        });

        return { userId: user.id };
      });

      const createdUser = await fastify.prisma.user.findUnique({
        where: { id: result.userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          organizationId: true,
        },
      });

      fastify.log.info(
        { userId: createdUser!.id, email, accountType },
        "User created by admin",
      );

      return reply.code(201).send({ ok: true, user: createdUser });
    },
  });

  fastify.patch("/api/admin/users/:userId", {
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

      const parseResult = updateUserBodySchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const { name, email, organizationName } = parseResult.data;

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
      });

      if (!user) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Usuario no encontrado." },
        });
      }

      if (email) {
        const existingEmail = await fastify.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingEmail && existingEmail.id !== userId) {
          return reply.code(409).send({
            error: {
              code: "CONFLICT",
              message: "El email ya está registrado por otro usuario.",
            },
          });
        }
      }

      const updateUserData: { name?: string; email?: string } = {};
      if (name) updateUserData.name = name;
      if (email) updateUserData.email = email;

      if (Object.keys(updateUserData).length > 0) {
        await fastify.prisma.user.update({
          where: { id: userId },
          data: updateUserData,
        });
      }

      if (organizationName && user.organizationId) {
        await fastify.prisma.organization.update({
          where: { id: user.organizationId },
          data: { name: organizationName },
        });
      }

      fastify.log.info(
        { userId, updates: { name, email, organizationName } },
        "User updated by admin",
      );

      return reply.send({
        ok: true,
        message: "Usuario actualizado correctamente",
      });
    },
  });

  fastify.delete("/api/admin/users/:userId", {
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

      if (request.user.userId === userId) {
        return reply.code(400).send({
          error: {
            code: "BAD_REQUEST",
            message: "No puedes eliminarte a ti mismo.",
          },
        });
      }

      const { reason } = (request.body as { reason?: string }) ?? {};

      const target = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!target) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Usuario no encontrado." },
        });
      }

      await fastify.prisma.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          deletedReason: reason ?? null,
          bannedAt: null,
          bannedReason: null,
        },
      });

      fastify.log.info({ userId, reason }, "User soft-deleted by admin");

      return reply.send({
        ok: true,
        message: "Usuario eliminado correctamente",
      });
    },
  });
}
