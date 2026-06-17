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

const createUserBodySchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido"),
    email: z.string().email("Email inválido"),
    password: z.string().min(12, "La contraseña debe tener al menos 12 caracteres"),
    accountType: z.enum(["INDIVIDUAL", "ORGANIZATION"]),
    organizationName: z.string().optional(),
  })
  .refine(
    (data) =>
      data.accountType !== "ORGANIZATION" ||
      (data.organizationName && data.organizationName.length > 0),
    {
      message: "organizationName es requerido para cuentas ORGANIZATION",
      path: ["organizationName"],
    },
  );

const updateUserBodySchema = z.object({
  name: z.string().min(1, "El nombre no puede estar vacío").optional(),
  email: z.string().email("Email inválido").optional(),
  organizationName: z
    .string()
    .min(1, "El nombre de la organización no puede estar vacío")
    .optional(),
});

const adminUpdatePlanSchema = z.object({
  name: z.string().min(1, "El nombre no puede estar vacío").optional(),
  description: z.string().optional().nullable(),
  monthlyPriceCents: z.number().int().min(0).optional(),
  yearlyPriceCents: z.number().int().min(0).optional(),
  currency: z.string().min(1).optional(),
  stripeMonthlyPriceId: z.string().optional().nullable(),
  stripeYearlyPriceId: z.string().optional().nullable(),
  features: z.array(z.string()).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxRfcProfiles: z.number().int().min(1).optional(),
  monthlyUsageLimit: z.number().int().min(0).optional().nullable(),
  isPublic: z.boolean().optional(),
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

      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
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
        message:
          status === "BANNED"
            ? "Usuario suspendido correctamente."
            : "Usuario reactivado correctamente.",
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
      const orgName = accountType === "ORGANIZATION" ? organizationName || name : name;

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

      fastify.log.info({ userId: createdUser!.id, email, accountType }, "User created by admin");

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

  fastify.get("/api/admin/xml-analyses", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
        riskLevel?: string;
        rfcEmisor?: string;
        rfcReceptor?: string;
        uuid?: string;
        tipoComprobante?: string;
        from?: string;
        to?: string;
        analysisStatus?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize ?? "50", 10) || 50));
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {};

      if (query.riskLevel) where.riskLevel = query.riskLevel;
      if (query.rfcEmisor) where.rfcEmisor = { contains: query.rfcEmisor, mode: "insensitive" };
      if (query.rfcReceptor)
        where.rfcReceptor = { contains: query.rfcReceptor, mode: "insensitive" };
      if (query.uuid) where.uuid = { contains: query.uuid, mode: "insensitive" };
      if (query.tipoComprobante) where.tipoComprobante = query.tipoComprobante;
      if (query.analysisStatus) where.analysisStatus = query.analysisStatus;
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt.gte = new Date(query.from);
        if (query.to) createdAt.lte = new Date(query.to);
        where.createdAt = createdAt;
      }

      const [total, items] = await Promise.all([
        fastify.prisma.xmlAnalysisRecord.count({ where: where as any }),
        fastify.prisma.xmlAnalysisRecord.findMany({
          where: where as any,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            userId: true,
            organizationId: true,
            analysisStatus: true,
            errorCode: true,
            errorMessage: true,
            uuid: true,
            tipoComprobante: true,
            rfcEmisor: true,
            nombreEmisor: true,
            rfcReceptor: true,
            nombreReceptor: true,
            fecha: true,
            total: true,
            subtotal: true,
            moneda: true,
            version: true,
            serie: true,
            folio: true,
            riskLevel: true,
            findingsCount: true,
            criticalCount: true,
            warningCount: true,
            infoCount: true,
            hasBom: true,
            hasTechnicalNormalization: true,
            hasNormalizedXml: true,
            normalizedFilename: true,
            originalSha256: true,
            normalizedSha256: true,
            sourceType: true,
            sourceFilename: true,
            batchId: true,
            zipFilename: true,
            zipEntryName: true,
            zipEntryIndex: true,
            user: { select: { email: true } },
            organization: { select: { name: true } },
          },
        }),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      return reply.send({
        items: items.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
          userId: r.userId,
          userEmail: r.user.email,
          organizationId: r.organizationId,
          organizationName: r.organization?.name ?? null,
          analysisStatus: r.analysisStatus,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          uuid: r.uuid,
          tipoComprobante: r.tipoComprobante,
          rfcEmisor: r.rfcEmisor,
          nombreEmisor: r.nombreEmisor,
          rfcReceptor: r.rfcReceptor,
          nombreReceptor: r.nombreReceptor,
          fecha: r.fecha,
          total: r.total,
          subtotal: r.subtotal,
          moneda: r.moneda,
          version: r.version,
          serie: r.serie,
          folio: r.folio,
          riskLevel: r.riskLevel,
          findingsCount: r.findingsCount,
          criticalCount: r.criticalCount,
          warningCount: r.warningCount,
          infoCount: r.infoCount,
          hasBom: r.hasBom,
          hasTechnicalNormalization: r.hasTechnicalNormalization,
          hasNormalizedXml: r.hasNormalizedXml,
          normalizedFilename: r.normalizedFilename,
          originalSha256: r.originalSha256,
          normalizedSha256: r.normalizedSha256,
          sourceType: r.sourceType,
          sourceFilename: r.sourceFilename,
          batchId: r.batchId,
          zipFilename: r.zipFilename,
          zipEntryName: r.zipEntryName,
          zipEntryIndex: r.zipEntryIndex,
        })),
        pagination: { page, pageSize, total, totalPages },
      });
    },
  });

  fastify.get("/api/admin/xml-analyses/export", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const query = request.query as {
        riskLevel?: string;
        rfcEmisor?: string;
        rfcReceptor?: string;
        uuid?: string;
        tipoComprobante?: string;
        from?: string;
        to?: string;
        analysisStatus?: string;
      };

      const where: Record<string, unknown> = {};
      if (query.riskLevel) where.riskLevel = query.riskLevel;
      if (query.rfcEmisor) where.rfcEmisor = { contains: query.rfcEmisor, mode: "insensitive" };
      if (query.rfcReceptor)
        where.rfcReceptor = { contains: query.rfcReceptor, mode: "insensitive" };
      if (query.uuid) where.uuid = { contains: query.uuid, mode: "insensitive" };
      if (query.tipoComprobante) where.tipoComprobante = query.tipoComprobante;
      if (query.analysisStatus) where.analysisStatus = query.analysisStatus;
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt.gte = new Date(query.from);
        if (query.to) createdAt.lte = new Date(query.to);
        where.createdAt = createdAt;
      }

      const records = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        take: 5000,
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          userId: true,
          analysisStatus: true,
          errorCode: true,
          errorMessage: true,
          uuid: true,
          tipoComprobante: true,
          rfcEmisor: true,
          nombreEmisor: true,
          rfcReceptor: true,
          nombreReceptor: true,
          fecha: true,
          total: true,
          subtotal: true,
          moneda: true,
          version: true,
          serie: true,
          folio: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          normalizedFilename: true,
          originalSha256: true,
          normalizedSha256: true,
          sourceType: true,
          sourceFilename: true,
          batchId: true,
          zipFilename: true,
          zipEntryName: true,
          zipEntryIndex: true,
          user: { select: { email: true } },
          organization: { select: { name: true, id: true } },
        },
      });

      function esc(val: string | null | undefined): string {
        if (val === null || val === undefined) return "";
        const v = String(val).replace(/"/g, '""');
        return /[",\n\r]/.test(v) ? `"${v}"` : v;
      }

      const header = [
        "ID",
        "Fecha analisis",
        "Expira",
        "Usuario ID",
        "Usuario email",
        "Organizacion ID",
        "Organizacion",
        "Estado analisis",
        "Codigo error",
        "Mensaje error",
        "UUID",
        "Tipo comprobante",
        "RFC emisor",
        "Nombre emisor",
        "RFC receptor",
        "Nombre receptor",
        "Fecha CFDI",
        "Subtotal",
        "Total",
        "Moneda",
        "Version",
        "Serie",
        "Folio",
        "Riesgo",
        "Hallazgos",
        "Criticos",
        "Advertencias",
        "Informativos",
        "BOM",
        "Normalizacion tecnica",
        "XML normalizado",
        "Archivo normalizado",
        "Hash original SHA-256",
        "Hash normalizado SHA-256",
        "Origen",
        "Archivo fuente",
        "Batch ID",
        "ZIP filename",
        "ZIP entry",
        "ZIP entry index",
      ].join(",");

      const rows = records.map((r) =>
        [
          esc(r.id),
          esc(r.createdAt.toISOString()),
          esc(r.expiresAt.toISOString()),
          esc(r.userId),
          esc(r.user.email),
          esc(r.organization?.id ?? null),
          esc(r.organization?.name ?? null),
          esc(r.analysisStatus),
          esc(r.errorCode),
          esc(r.errorMessage),
          esc(r.uuid),
          esc(r.tipoComprobante),
          esc(r.rfcEmisor),
          esc(r.nombreEmisor),
          esc(r.rfcReceptor),
          esc(r.nombreReceptor),
          esc(r.fecha),
          esc(r.subtotal),
          esc(r.total),
          esc(r.moneda),
          esc(r.version),
          esc(r.serie),
          esc(r.folio),
          esc(r.riskLevel),
          String(r.findingsCount),
          String(r.criticalCount),
          String(r.warningCount),
          String(r.infoCount),
          r.hasBom ? "Sí" : "No",
          r.hasTechnicalNormalization ? "Sí" : "No",
          r.hasNormalizedXml ? "Sí" : "No",
          esc(r.normalizedFilename),
          esc(r.originalSha256),
          esc(r.normalizedSha256),
          esc(r.sourceType),
          esc(r.sourceFilename),
          esc(r.batchId),
          esc(r.zipFilename),
          esc(r.zipEntryName),
          r.zipEntryIndex != null ? String(r.zipEntryIndex) : "",
        ].join(","),
      );

      const bom = "\uFEFF";
      const csv = bom + header + "\r\n" + rows.join("\r\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header(
        "Content-Disposition",
        'attachment; filename="fiscora-analisis-xml-recientes.csv"',
      );
      return reply.send(csv);
    },
  });

  fastify.get("/api/admin/xml-analyses/:id", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const { id } = request.params as { id: string };

      const record = await fastify.prisma.xmlAnalysisRecord.findUnique({
        where: { id },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          userId: true,
          organizationId: true,
          analysisStatus: true,
          errorCode: true,
          errorMessage: true,
          uuid: true,
          tipoComprobante: true,
          rfcEmisor: true,
          nombreEmisor: true,
          rfcReceptor: true,
          nombreReceptor: true,
          fecha: true,
          total: true,
          subtotal: true,
          moneda: true,
          version: true,
          serie: true,
          folio: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          normalizedFilename: true,
          originalSha256: true,
          normalizedSha256: true,
          sourceType: true,
          sourceFilename: true,
          batchId: true,
          zipFilename: true,
          zipEntryName: true,
          zipEntryIndex: true,
          analysisJson: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      if (!record) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Registro no encontrado." },
        });
      }

      return reply.send({
        id: record.id,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        userId: record.userId,
        userEmail: record.user.email,
        organizationId: record.organizationId,
        organizationName: record.organization?.name ?? null,
        analysisStatus: record.analysisStatus,
        errorCode: record.errorCode,
        errorMessage: record.errorMessage,
        uuid: record.uuid,
        tipoComprobante: record.tipoComprobante,
        rfcEmisor: record.rfcEmisor,
        nombreEmisor: record.nombreEmisor,
        rfcReceptor: record.rfcReceptor,
        nombreReceptor: record.nombreReceptor,
        fecha: record.fecha,
        total: record.total,
        subtotal: record.subtotal,
        moneda: record.moneda,
        version: record.version,
        serie: record.serie,
        folio: record.folio,
        riskLevel: record.riskLevel,
        findingsCount: record.findingsCount,
        criticalCount: record.criticalCount,
        warningCount: record.warningCount,
        infoCount: record.infoCount,
        hasBom: record.hasBom,
        hasTechnicalNormalization: record.hasTechnicalNormalization,
        hasNormalizedXml: record.hasNormalizedXml,
        normalizedFilename: record.normalizedFilename,
        originalSha256: record.originalSha256,
        normalizedSha256: record.normalizedSha256,
        sourceType: record.sourceType,
        sourceFilename: record.sourceFilename,
        batchId: record.batchId,
        zipFilename: record.zipFilename,
        zipEntryName: record.zipEntryName,
        zipEntryIndex: record.zipEntryIndex,
        analysisJson: record.analysisJson,
      });
    },
  });

  fastify.get("/api/admin/xml-analysis-batches", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const query = request.query as {
        page?: string;
        pageSize?: string;
        batchId?: string;
        zipFilename?: string;
        userEmail?: string;
        organizationName?: string;
        from?: string;
        to?: string;
        hasFailed?: string;
        hasCritical?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? "25", 10) || 25));
      const skip = (page - 1) * pageSize;

      // Build base WHERE for individual records; we'll filter after grouping
      const recordWhere: Record<string, unknown> = {
        sourceType: "ZIP",
        batchId: { not: null },
      };

      if (query.batchId) recordWhere.batchId = query.batchId;
      if (query.zipFilename)
        recordWhere.zipFilename = { contains: query.zipFilename, mode: "insensitive" };
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt.gte = new Date(query.from);
        if (query.to) createdAt.lte = new Date(query.to);
        recordWhere.createdAt = createdAt;
      }

      // Fetch all matching records within retention window
      // Apply a generous limit as safety since we group in memory
      const matchedRecords = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: recordWhere as any,
        orderBy: { createdAt: "desc" },
        take: 20000,
        select: {
          id: true,
          batchId: true,
          zipFilename: true,
          createdAt: true,
          expiresAt: true,
          userId: true,
          organizationId: true,
          analysisStatus: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          tipoComprobante: true,
          zipEntryName: true,
          zipEntryIndex: true,
          uuid: true,
          rfcEmisor: true,
          nombreEmisor: true,
          rfcReceptor: true,
          nombreReceptor: true,
          errorCode: true,
          errorMessage: true,
          normalizedFilename: true,
          originalSha256: true,
          normalizedSha256: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      // Group by batchId
      const groups = new Map<string, typeof matchedRecords>();
      for (const rec of matchedRecords) {
        const bid = rec.batchId!;
        const g = groups.get(bid);
        if (g) g.push(rec);
        else groups.set(bid, [rec]);
      }

      // Build batch summary items
      const allBatches = Array.from(groups.entries()).map(([batchId, records]) => {
        const first = records.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        const last = records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        const expiresAt = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b)).expiresAt;

        const analyzedCount = records.filter((r) => r.analysisStatus === "ANALYZED").length;
        const failedCount = records.filter((r) => r.analysisStatus === "FAILED").length;
        const criticalCount = records.reduce((s, r) => s + r.criticalCount, 0);
        const warningCount = records.reduce((s, r) => s + r.warningCount, 0);
        const infoCount = records.reduce((s, r) => s + r.infoCount, 0);
        const okCount = records.filter(
          (r) => r.analysisStatus === "ANALYZED" && r.riskLevel === "OK",
        ).length;
        const recordsWithBom = records.filter((r) => r.hasBom).length;
        const recordsWithNormalization = records.filter((r) => r.hasTechnicalNormalization).length;
        const recordsWithNormalizedXml = records.filter((r) => r.hasNormalizedXml).length;

        const tiposComprobante: Record<string, number> = {};
        for (const r of records) {
          if (r.tipoComprobante) {
            tiposComprobante[r.tipoComprobante] = (tiposComprobante[r.tipoComprobante] ?? 0) + 1;
          }
        }

        return {
          batchId,
          zipFilename: first.zipFilename ?? "—",
          createdAtFirst: first.createdAt,
          createdAtLast: last.createdAt,
          expiresAt,
          userId: first.userId,
          userEmail: first.user.email,
          organizationId: first.organizationId,
          organizationName: first.organization?.name ?? null,
          totalRecords: records.length,
          analyzedCount,
          failedCount,
          criticalCount,
          warningCount,
          infoCount,
          okCount,
          recordsWithBom,
          recordsWithNormalization,
          recordsWithNormalizedXml,
          tiposComprobante,
        };
      });

      // Apply post-group filters
      let filtered = allBatches;
      if (query.userEmail) {
        const q = query.userEmail.toLowerCase();
        filtered = filtered.filter((b) => b.userEmail.toLowerCase().includes(q));
      }
      if (query.organizationName) {
        const q = query.organizationName.toLowerCase();
        filtered = filtered.filter((b) => b.organizationName?.toLowerCase().includes(q) ?? false);
      }
      if (query.hasFailed === "true") filtered = filtered.filter((b) => b.failedCount > 0);
      if (query.hasCritical === "true") filtered = filtered.filter((b) => b.criticalCount > 0);

      // Sort by most recent first
      filtered.sort((a, b) => b.createdAtFirst.getTime() - a.createdAtFirst.getTime());

      const total = filtered.length;
      const totalPages = Math.ceil(total / pageSize);
      const items = filtered.slice(skip, skip + pageSize);

      return reply.send({
        items: items.map((b) => ({
          ...b,
          createdAtFirst: b.createdAtFirst.toISOString(),
          createdAtLast: b.createdAtLast.toISOString(),
          expiresAt: b.expiresAt.toISOString(),
        })),
        pagination: { page, pageSize, total, totalPages },
      });
    },
  });

  fastify.get("/api/admin/xml-analysis-batches/export", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const query = request.query as {
        batchId?: string;
        zipFilename?: string;
        userEmail?: string;
        organizationName?: string;
        from?: string;
        to?: string;
        hasFailed?: string;
        hasCritical?: string;
      };

      const recordWhere: Record<string, unknown> = {
        sourceType: "ZIP",
        batchId: { not: null },
      };

      if (query.batchId) recordWhere.batchId = query.batchId;
      if (query.zipFilename)
        recordWhere.zipFilename = { contains: query.zipFilename, mode: "insensitive" };
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt.gte = new Date(query.from);
        if (query.to) createdAt.lte = new Date(query.to);
        recordWhere.createdAt = createdAt;
      }

      const matchedRecords = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: recordWhere as any,
        orderBy: { createdAt: "desc" },
        take: 20000,
        select: {
          batchId: true,
          zipFilename: true,
          createdAt: true,
          expiresAt: true,
          userId: true,
          organizationId: true,
          analysisStatus: true,
          riskLevel: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          tipoComprobante: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      const groups = new Map<string, typeof matchedRecords>();
      for (const rec of matchedRecords) {
        const bid = rec.batchId!;
        const g = groups.get(bid);
        if (g) g.push(rec);
        else groups.set(bid, [rec]);
      }

      const allBatches = Array.from(groups.entries()).map(([batchId, records]) => {
        const first = records.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        const last = records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
        const expiresAt = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b)).expiresAt;
        const analyzedCount = records.filter((r) => r.analysisStatus === "ANALYZED").length;
        const failedCount = records.filter((r) => r.analysisStatus === "FAILED").length;
        const criticalCount = records.reduce((s, r) => s + r.criticalCount, 0);
        const warningCount = records.reduce((s, r) => s + r.warningCount, 0);
        const infoCount = records.reduce((s, r) => s + r.infoCount, 0);
        const okCount = records.filter(
          (r) => r.analysisStatus === "ANALYZED" && r.riskLevel === "OK",
        ).length;
        const recordsWithBom = records.filter((r) => r.hasBom).length;
        const recordsWithNormalization = records.filter((r) => r.hasTechnicalNormalization).length;
        const recordsWithNormalizedXml = records.filter((r) => r.hasNormalizedXml).length;
        const tipos: Record<string, number> = {};
        for (const r of records)
          if (r.tipoComprobante) tipos[r.tipoComprobante] = (tipos[r.tipoComprobante] ?? 0) + 1;

        return {
          batchId,
          zipFilename: first.zipFilename ?? "—",
          createdAtFirst: first.createdAt,
          createdAtLast: last.createdAt,
          expiresAt,
          userId: first.userId,
          userEmail: first.user.email,
          organizationId: first.organizationId,
          organizationName: first.organization?.name ?? null,
          totalRecords: records.length,
          analyzedCount,
          failedCount,
          criticalCount,
          warningCount,
          infoCount,
          okCount,
          recordsWithBom,
          recordsWithNormalization,
          recordsWithNormalizedXml,
          tiposComprobante: Object.entries(tipos)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" | "),
          hasFailed: failedCount > 0 ? "Sí" : "No",
          hasCritical: criticalCount > 0 ? "Sí" : "No",
        };
      });

      let filtered = allBatches;
      if (query.userEmail) {
        const q = query.userEmail.toLowerCase();
        filtered = filtered.filter((b) => b.userEmail.toLowerCase().includes(q));
      }
      if (query.organizationName) {
        const q = query.organizationName.toLowerCase();
        filtered = filtered.filter((b) => b.organizationName?.toLowerCase().includes(q) ?? false);
      }
      if (query.hasFailed === "true") filtered = filtered.filter((b) => b.failedCount > 0);
      if (query.hasCritical === "true") filtered = filtered.filter((b) => b.criticalCount > 0);

      filtered.sort((a, b) => b.createdAtFirst.getTime() - a.createdAtFirst.getTime());
      const exportItems = filtered.slice(0, 5000);

      function esc(val: string | null | undefined): string {
        if (val === null || val === undefined) return "";
        const v = String(val).replace(/"/g, '""');
        return /[",\n\r]/.test(v) ? `"${v}"` : v;
      }

      const header = [
        "Batch ID",
        "ZIP",
        "Fecha inicio",
        "Fecha fin",
        "Expira",
        "Usuario ID",
        "Usuario email",
        "Organizacion ID",
        "Organizacion",
        "Total registros",
        "Analizados",
        "Fallidos",
        "Criticos",
        "Advertencias",
        "Informativos",
        "OK",
        "XMLs con BOM",
        "XMLs con normalizacion tecnica",
        "XMLs normalizados",
        "Tipos de comprobante",
        "Tiene fallidos",
        "Tiene criticos",
      ].join(",");

      const rows = exportItems.map((b) =>
        [
          esc(b.batchId),
          esc(b.zipFilename),
          esc(b.createdAtFirst.toISOString()),
          esc(b.createdAtLast.toISOString()),
          esc(b.expiresAt.toISOString()),
          esc(b.userId),
          esc(b.userEmail),
          esc(b.organizationId),
          esc(b.organizationName),
          String(b.totalRecords),
          String(b.analyzedCount),
          String(b.failedCount),
          String(b.criticalCount),
          String(b.warningCount),
          String(b.infoCount),
          String(b.okCount),
          String(b.recordsWithBom),
          String(b.recordsWithNormalization),
          String(b.recordsWithNormalizedXml),
          esc(b.tiposComprobante),
          esc(b.hasFailed),
          esc(b.hasCritical),
        ].join(","),
      );

      const bom = "\uFEFF";
      const csv = bom + header + "\r\n" + rows.join("\r\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", 'attachment; filename="fiscora-lotes-xml-zip.csv"');
      return reply.send(csv);
    },
  });

  fastify.get("/api/admin/xml-analysis-batches/:batchId", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const { batchId } = request.params as { batchId: string };

      const records = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: { batchId, sourceType: "ZIP" },
        orderBy: { zipEntryIndex: "asc" },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          analysisStatus: true,
          errorCode: true,
          errorMessage: true,
          zipEntryName: true,
          zipEntryIndex: true,
          uuid: true,
          tipoComprobante: true,
          rfcEmisor: true,
          nombreEmisor: true,
          rfcReceptor: true,
          nombreReceptor: true,
          fecha: true,
          subtotal: true,
          total: true,
          moneda: true,
          version: true,
          serie: true,
          folio: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          normalizedFilename: true,
          originalSha256: true,
          normalizedSha256: true,
          zipFilename: true,
          userId: true,
          organizationId: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      if (records.length === 0) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Lote ZIP no encontrado." },
        });
      }

      const first = records[0];
      const last = records[records.length - 1];
      const expiresAt = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b)).expiresAt;

      const analyzedCount = records.filter((r) => r.analysisStatus === "ANALYZED").length;
      const failedCount = records.filter((r) => r.analysisStatus === "FAILED").length;
      const criticalCount = records.reduce((s, r) => s + r.criticalCount, 0);
      const warningCount = records.reduce((s, r) => s + r.warningCount, 0);
      const infoCount = records.reduce((s, r) => s + r.infoCount, 0);
      const okCount = records.filter(
        (r) => r.analysisStatus === "ANALYZED" && r.riskLevel === "OK",
      ).length;
      const recordsWithBom = records.filter((r) => r.hasBom).length;
      const recordsWithNormalization = records.filter((r) => r.hasTechnicalNormalization).length;
      const recordsWithNormalizedXml = records.filter((r) => r.hasNormalizedXml).length;

      const tiposComprobante: Record<string, number> = {};
      for (const r of records) {
        if (r.tipoComprobante) {
          tiposComprobante[r.tipoComprobante] = (tiposComprobante[r.tipoComprobante] ?? 0) + 1;
        }
      }

      return reply.send({
        batch: {
          batchId,
          zipFilename: first.zipFilename ?? "—",
          createdAtFirst: first.createdAt.toISOString(),
          createdAtLast: last.createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          userId: first.userId,
          userEmail: first.user.email,
          organizationId: first.organizationId,
          organizationName: first.organization?.name ?? null,
          totalRecords: records.length,
          analyzedCount,
          failedCount,
          criticalCount,
          warningCount,
          infoCount,
          okCount,
          recordsWithBom,
          recordsWithNormalization,
          recordsWithNormalizedXml,
          tiposComprobante,
        },
        records: records.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt.toISOString(),
          analysisStatus: r.analysisStatus,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          zipEntryName: r.zipEntryName,
          zipEntryIndex: r.zipEntryIndex,
          uuid: r.uuid,
          tipoComprobante: r.tipoComprobante,
          rfcEmisor: r.rfcEmisor,
          nombreEmisor: r.nombreEmisor,
          rfcReceptor: r.rfcReceptor,
          nombreReceptor: r.nombreReceptor,
          fecha: r.fecha,
          subtotal: r.subtotal,
          total: r.total,
          moneda: r.moneda,
          version: r.version,
          serie: r.serie,
          folio: r.folio,
          riskLevel: r.riskLevel,
          findingsCount: r.findingsCount,
          criticalCount: r.criticalCount,
          warningCount: r.warningCount,
          infoCount: r.infoCount,
          hasBom: r.hasBom,
          hasTechnicalNormalization: r.hasTechnicalNormalization,
          hasNormalizedXml: r.hasNormalizedXml,
          normalizedFilename: r.normalizedFilename,
          originalSha256: r.originalSha256,
          normalizedSha256: r.normalizedSha256,
        })),
      });
    },
  });

  fastify.get("/api/admin/xml-analysis-batches/:batchId/export", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const { batchId } = request.params as { batchId: string };

      const records = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: { batchId, sourceType: "ZIP" },
        orderBy: { zipEntryIndex: "asc" },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          analysisStatus: true,
          errorCode: true,
          errorMessage: true,
          zipEntryName: true,
          zipEntryIndex: true,
          uuid: true,
          tipoComprobante: true,
          rfcEmisor: true,
          nombreEmisor: true,
          rfcReceptor: true,
          nombreReceptor: true,
          fecha: true,
          subtotal: true,
          total: true,
          moneda: true,
          version: true,
          serie: true,
          folio: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          normalizedFilename: true,
          originalSha256: true,
          normalizedSha256: true,
          zipFilename: true,
          userId: true,
          organizationId: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      if (records.length === 0) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Lote ZIP no encontrado." },
        });
      }

      const first = records[0];

      function esc(val: string | null | undefined): string {
        if (val === null || val === undefined) return "";
        const v = String(val).replace(/"/g, '""');
        return /[",\n\r]/.test(v) ? `"${v}"` : v;
      }

      const header = [
        "Batch ID",
        "ZIP",
        "Indice ZIP",
        "Entrada ZIP",
        "Estado analisis",
        "Codigo error",
        "Mensaje error",
        "Fecha analisis",
        "Expira",
        "Usuario ID",
        "Usuario email",
        "Organizacion ID",
        "Organizacion",
        "UUID",
        "Tipo comprobante",
        "RFC emisor",
        "Nombre emisor",
        "RFC receptor",
        "Nombre receptor",
        "Fecha CFDI",
        "Subtotal",
        "Total",
        "Moneda",
        "Version",
        "Serie",
        "Folio",
        "Riesgo",
        "Hallazgos",
        "Criticos",
        "Advertencias",
        "Informativos",
        "BOM",
        "Normalizacion tecnica",
        "XML normalizado",
        "Archivo normalizado",
        "Hash original SHA-256",
        "Hash normalizado SHA-256",
      ].join(",");

      const rows = records.map((r) =>
        [
          esc(batchId),
          esc(first.zipFilename),
          r.zipEntryIndex != null ? String(r.zipEntryIndex) : "",
          esc(r.zipEntryName),
          esc(r.analysisStatus),
          esc(r.errorCode),
          esc(r.errorMessage),
          esc(r.createdAt.toISOString()),
          esc(r.expiresAt.toISOString()),
          esc(r.userId),
          esc(r.user.email),
          esc(r.organizationId),
          esc(r.organization?.name ?? null),
          esc(r.uuid),
          esc(r.tipoComprobante),
          esc(r.rfcEmisor),
          esc(r.nombreEmisor),
          esc(r.rfcReceptor),
          esc(r.nombreReceptor),
          esc(r.fecha),
          esc(r.subtotal),
          esc(r.total),
          esc(r.moneda),
          esc(r.version),
          esc(r.serie),
          esc(r.folio),
          esc(r.riskLevel),
          String(r.findingsCount),
          String(r.criticalCount),
          String(r.warningCount),
          String(r.infoCount),
          r.hasBom ? "Sí" : "No",
          r.hasTechnicalNormalization ? "Sí" : "No",
          r.hasNormalizedXml ? "Sí" : "No",
          esc(r.normalizedFilename),
          esc(r.originalSha256),
          esc(r.normalizedSha256),
        ].join(","),
      );

      const bom = "\uFEFF";
      const csv = bom + header + "\r\n" + rows.join("\r\n");

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header(
        "Content-Disposition",
        `attachment; filename="fiscora-lote-xml-zip-${batchId}.csv"`,
      );
      return reply.send(csv);
    },
  });

  // ── Analytics V2 helpers ──────────────────────────────────────

  interface DocumentKindAgg {
    documentKind: "CFDI" | "RETENCIONES" | "UNKNOWN" | "NO_DATA";
    count: number;
  }

  function deriveDocumentKinds(
    records: { analysisJson: unknown; analysisStatus: string }[],
  ): DocumentKindAgg[] {
    const map = new Map<string, number>();
    for (const r of records) {
      if (
        r.analysisStatus !== "ANALYZED" ||
        !r.analysisJson ||
        typeof r.analysisJson !== "object"
      ) {
        map.set("NO_DATA", (map.get("NO_DATA") ?? 0) + 1);
        continue;
      }
      const aj = r.analysisJson as Record<string, unknown>;
      let dk = aj.documentKind as string | undefined;
      if (!dk) {
        const meta = aj.analysisMeta as Record<string, unknown> | undefined;
        const cov = meta?.coverage as Record<string, unknown> | undefined;
        dk = cov?.documentKind as string | undefined;
      }
      if (dk && ["CFDI", "RETENCIONES", "UNKNOWN"].includes(dk)) {
        map.set(dk, (map.get(dk) ?? 0) + 1);
      } else {
        map.set("NO_DATA", (map.get("NO_DATA") ?? 0) + 1);
      }
    }
    const order = ["CFDI", "RETENCIONES", "UNKNOWN", "NO_DATA"];
    return Array.from(map.entries())
      .map(([documentKind, count]) => ({ documentKind, count }) as DocumentKindAgg)
      .sort((a, b) => order.indexOf(a.documentKind) - order.indexOf(b.documentKind));
  }

  interface PriorityAgg {
    priority: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "NO_DATA";
    findings: number;
    recordsAffected: number;
  }

  function derivePriorities(
    records: { id: string; analysisJson: unknown; analysisStatus: string }[],
  ): PriorityAgg[] {
    const map = new Map<string, { findings: number; records: Set<string> }>();
    const initPriority = (p: string) => {
      if (!map.has(p)) map.set(p, { findings: 0, records: new Set() });
    };
    initPriority("BLOCKER");
    initPriority("HIGH");
    initPriority("MEDIUM");
    initPriority("LOW");
    initPriority("NO_DATA");

    for (const r of records) {
      if (
        r.analysisStatus !== "ANALYZED" ||
        !r.analysisJson ||
        typeof r.analysisJson !== "object"
      ) {
        const nd = map.get("NO_DATA")!;
        nd.findings++;
        nd.records.add(r.id);
        continue;
      }
      const aj = r.analysisJson as Record<string, unknown>;
      const findings = aj.findings as Array<Record<string, unknown>> | undefined;
      if (!findings || !Array.isArray(findings) || findings.length === 0) {
        const nd = map.get("NO_DATA")!;
        nd.findings++;
        nd.records.add(r.id);
        continue;
      }
      const recordPriorities = new Set<string>();
      for (const f of findings) {
        let priority = f.priority as string | undefined;
        if (!priority) {
          const severity = f.severity as string | undefined;
          if (severity === "CRITICAL") priority = "BLOCKER";
          else if (severity === "WARNING") priority = "HIGH";
          else if (severity === "INFO") priority = "LOW";
          else priority = "NO_DATA";
        }
        if (!["BLOCKER", "HIGH", "MEDIUM", "LOW"].includes(priority)) priority = "NO_DATA";
        const entry = map.get(priority)!;
        entry.findings++;
        recordPriorities.add(priority);
      }
      for (const p of recordPriorities) {
        map.get(p)!.records.add(r.id);
      }
    }

    const order = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "NO_DATA"];
    return Array.from(map.entries())
      .map(
        ([priority, data]) =>
          ({
            priority,
            findings: data.findings,
            recordsAffected: data.records.size,
          }) as PriorityAgg,
      )
      .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
  }

  interface ActionGroupAgg {
    actionGroup: string;
    findings: number;
    recordsAffected: number;
    critical: number;
    warning: number;
    info: number;
  }

  function deriveActionGroups(
    records: { id: string; analysisJson: unknown; analysisStatus: string }[],
  ): ActionGroupAgg[] {
    const map = new Map<
      string,
      { findings: number; records: Set<string>; critical: number; warning: number; info: number }
    >();
    for (const r of records) {
      if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
        continue;
      const aj = r.analysisJson as Record<string, unknown>;
      const findings = aj.findings as Array<Record<string, unknown>> | undefined;
      if (!findings || !Array.isArray(findings)) continue;
      const recordGroups = new Set<string>();
      for (const f of findings) {
        const ag = (f.actionGroup as string) || "Sin grupo";
        let entry = map.get(ag);
        if (!entry) {
          entry = { findings: 0, records: new Set(), critical: 0, warning: 0, info: 0 };
          map.set(ag, entry);
        }
        entry.findings++;
        recordGroups.add(ag);
        const severity = f.severity as string;
        if (severity === "CRITICAL") entry.critical++;
        else if (severity === "WARNING") entry.warning++;
        else if (severity === "INFO") entry.info++;
      }
      for (const ag of recordGroups) {
        map.get(ag)!.records.add(r.id);
      }
    }
    return Array.from(map.entries())
      .map(([actionGroup, data]) => ({
        actionGroup,
        findings: data.findings,
        recordsAffected: data.records.size,
        critical: data.critical,
        warning: data.warning,
        info: data.info,
      }))
      .sort((a, b) => b.findings - a.findings);
  }

  interface ModuleCoverageAgg {
    key: string;
    label: string;
    detectedInRecords: number;
    analyzedInRecords: number;
    findings: number;
    recordsWithFindings: number;
  }

  function deriveModulesCoverage(
    records: { id: string; analysisJson: unknown; analysisStatus: string }[],
  ): ModuleCoverageAgg[] {
    const map = new Map<
      string,
      {
        label: string;
        detected: Set<string>;
        analyzed: Set<string>;
        findings: number;
        recordsWithFindings: Set<string>;
      }
    >();
    for (const r of records) {
      if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
        continue;
      const aj = r.analysisJson as Record<string, unknown>;
      const meta = aj.analysisMeta as Record<string, unknown> | undefined;
      const cov = meta?.coverage as Record<string, unknown> | undefined;
      const modules = cov?.modules as Array<Record<string, unknown>> | undefined;
      if (!modules || !Array.isArray(modules)) continue;
      for (const mod of modules) {
        const key = mod.key as string;
        const label = mod.label as string;
        if (!key) continue;
        let entry = map.get(key);
        if (!entry) {
          entry = {
            label,
            detected: new Set(),
            analyzed: new Set(),
            findings: 0,
            recordsWithFindings: new Set(),
          };
          map.set(key, entry);
        }
        if (mod.detected) entry.detected.add(r.id);
        if (mod.analyzed) entry.analyzed.add(r.id);
        const fCount = typeof mod.findingsCount === "number" ? mod.findingsCount : 0;
        if (fCount > 0) {
          entry.findings += fCount;
          entry.recordsWithFindings.add(r.id);
        }
      }
    }
    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        label: data.label,
        detectedInRecords: data.detected.size,
        analyzedInRecords: data.analyzed.size,
        findings: data.findings,
        recordsWithFindings: data.recordsWithFindings.size,
      }))
      .sort((a, b) => b.findings - a.findings);
  }

  interface PerformanceAgg {
    recordsWithMeta: number;
    totalMs: number;
    avgMs: number;
    maxMs: number;
    minMs: number;
    totalInputKb: number;
    avgInputKb: number;
    totalFindingsOriginal: number;
    totalFindingsReturned: number;
    recordsWithTruncatedFindings: number;
  }

  function derivePerformance(
    records: { analysisJson: unknown; analysisStatus: string }[],
  ): PerformanceAgg {
    let recordsWithMeta = 0;
    let totalMs = 0;
    let maxMs = 0;
    let minMs = Infinity;
    let totalInputKb = 0;
    let totalFindingsOriginal = 0;
    let totalFindingsReturned = 0;
    let recordsWithTruncatedFindings = 0;
    for (const r of records) {
      if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
        continue;
      const aj = r.analysisJson as Record<string, unknown>;
      const meta = aj.analysisMeta as Record<string, unknown> | undefined;
      const perf = meta?.performance as Record<string, unknown> | undefined;
      if (!perf) continue;
      recordsWithMeta++;
      const ms = typeof perf.totalMs === "number" ? perf.totalMs : 0;
      totalMs += ms;
      if (ms > maxMs) maxMs = ms;
      if (ms < minMs) minMs = ms;
      const kb = typeof perf.inputKb === "number" ? perf.inputKb : 0;
      totalInputKb += kb;
      const orig = typeof perf.findingsOriginalCount === "number" ? perf.findingsOriginalCount : 0;
      totalFindingsOriginal += orig;
      const ret = typeof perf.findingsReturnedCount === "number" ? perf.findingsReturnedCount : 0;
      totalFindingsReturned += ret;
      if (perf.findingsTruncated) recordsWithTruncatedFindings++;
    }
    return {
      recordsWithMeta,
      totalMs,
      avgMs: recordsWithMeta > 0 ? Math.round((totalMs / recordsWithMeta) * 100) / 100 : 0,
      maxMs,
      minMs: recordsWithMeta > 0 ? minMs : 0,
      totalInputKb: Math.round(totalInputKb * 100) / 100,
      avgInputKb:
        recordsWithMeta > 0 ? Math.round((totalInputKb / recordsWithMeta) * 100) / 100 : 0,
      totalFindingsOriginal,
      totalFindingsReturned,
      recordsWithTruncatedFindings,
    };
  }

  interface TopFindingCodeAgg {
    code: string;
    title: string;
    severityMax: string;
    priorityMax: string;
    actionGroup: string | null;
    count: number;
    recordsAffected: number;
  }

  const severityRank: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const priorityRank: Record<string, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  function deriveTopFindingCodes(
    records: { id: string; analysisJson: unknown; analysisStatus: string }[],
  ): TopFindingCodeAgg[] {
    const map = new Map<
      string,
      {
        title: string;
        severityMax: string;
        priorityMax: string;
        actionGroupCounts: Map<string, number>;
        count: number;
        records: Set<string>;
      }
    >();
    for (const r of records) {
      if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
        continue;
      const aj = r.analysisJson as Record<string, unknown>;
      const findings = aj.findings as Array<Record<string, unknown>> | undefined;
      if (!findings || !Array.isArray(findings)) continue;
      for (const f of findings) {
        const code = f.code as string;
        if (!code) continue;
        let entry = map.get(code);
        if (!entry) {
          entry = {
            title: "",
            severityMax: "INFO",
            priorityMax: "LOW",
            actionGroupCounts: new Map(),
            count: 0,
            records: new Set(),
          };
          map.set(code, entry);
        }
        entry.count++;
        entry.records.add(r.id);
        if (!entry.title && f.title) entry.title = f.title as string;
        const sev = f.severity as string;
        if (
          sev &&
          severityRank[sev] !== undefined &&
          severityRank[sev] < severityRank[entry.severityMax]
        ) {
          entry.severityMax = sev;
        }
        const pri = f.priority as string;
        if (
          pri &&
          priorityRank[pri] !== undefined &&
          priorityRank[pri] < priorityRank[entry.priorityMax]
        ) {
          entry.priorityMax = pri;
        } else if (!pri) {
          const derivedSev = f.severity as string;
          let derivedPri = "LOW";
          if (derivedSev === "CRITICAL") derivedPri = "BLOCKER";
          else if (derivedSev === "WARNING") derivedPri = "HIGH";
          if (priorityRank[derivedPri] < priorityRank[entry.priorityMax]) {
            entry.priorityMax = derivedPri;
          }
        }
        const ag = f.actionGroup as string | undefined;
        if (ag) {
          entry.actionGroupCounts.set(ag, (entry.actionGroupCounts.get(ag) ?? 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .map(([code, data]) => {
        let bestAg: string | null = null;
        let bestCount = 0;
        for (const [ag, c] of data.actionGroupCounts) {
          if (c > bestCount) {
            bestCount = c;
            bestAg = ag;
          }
        }
        return {
          code,
          title: data.title || code,
          severityMax: data.severityMax,
          priorityMax: data.priorityMax,
          actionGroup: bestAg,
          count: data.count,
          recordsAffected: data.records.size,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  interface TopModuleAgg {
    key: string;
    label: string;
    findings: number;
    recordsAffected: number;
  }

  function deriveTopModulesByFindings(
    records: { id: string; analysisJson: unknown; analysisStatus: string }[],
  ): TopModuleAgg[] {
    const map = new Map<string, { label: string; findings: number; records: Set<string> }>();
    for (const r of records) {
      if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
        continue;
      const aj = r.analysisJson as Record<string, unknown>;
      const meta = aj.analysisMeta as Record<string, unknown> | undefined;
      const cov = meta?.coverage as Record<string, unknown> | undefined;
      const modules = cov?.modules as Array<Record<string, unknown>> | undefined;
      if (!modules || !Array.isArray(modules)) continue;
      for (const mod of modules) {
        const key = mod.key as string;
        if (!key) continue;
        const fCount = typeof mod.findingsCount === "number" ? mod.findingsCount : 0;
        if (fCount === 0) continue;
        let entry = map.get(key);
        if (!entry) {
          entry = { label: (mod.label as string) || key, findings: 0, records: new Set() };
          map.set(key, entry);
        }
        entry.findings += fCount;
        entry.records.add(r.id);
      }
    }
    return Array.from(map.entries())
      .map(([key, data]) => ({
        key,
        label: data.label,
        findings: data.findings,
        recordsAffected: data.records.size,
      }))
      .sort((a, b) => b.findings - a.findings)
      .slice(0, 10);
  }

  fastify.get("/api/admin/xml-analytics/summary", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const query = request.query as {
        from?: string;
        to?: string;
        organizationId?: string;
        userId?: string;
        sourceType?: string;
        analysisStatus?: string;
      };

      // Validate dates if provided
      if (query.from && isNaN(new Date(query.from).getTime())) {
        return reply.code(400).send({
          error: { code: "INVALID_DATE_RANGE", message: "La fecha 'desde' no es válida." },
        });
      }
      if (query.to && isNaN(new Date(query.to).getTime())) {
        return reply.code(400).send({
          error: { code: "INVALID_DATE_RANGE", message: "La fecha 'hasta' no es válida." },
        });
      }

      const where: Record<string, unknown> = {};

      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt.gte = new Date(query.from);
        if (query.to) createdAt.lte = new Date(query.to);
        where.createdAt = createdAt;
      }
      if (query.organizationId) where.organizationId = query.organizationId;
      if (query.userId) where.userId = query.userId;
      if (query.sourceType) where.sourceType = query.sourceType;
      if (query.analysisStatus) where.analysisStatus = query.analysisStatus;

      const records = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        take: 50000,
        select: {
          id: true,
          createdAt: true,
          userId: true,
          organizationId: true,
          analysisStatus: true,
          sourceType: true,
          riskLevel: true,
          findingsCount: true,
          criticalCount: true,
          warningCount: true,
          infoCount: true,
          hasBom: true,
          hasTechnicalNormalization: true,
          hasNormalizedXml: true,
          tipoComprobante: true,
          batchId: true,
          zipFilename: true,
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      });

      // Second query with analysisJson for analyticsV2 (same filters, same limit)
      const v2Records = await fastify.prisma.xmlAnalysisRecord.findMany({
        where: where as any,
        orderBy: { createdAt: "desc" },
        take: 50000,
        select: {
          id: true,
          analysisStatus: true,
          analysisJson: true,
        },
      });

      let analyticsV2: Record<string, unknown> | undefined;
      if (v2Records.length > 0) {
        analyticsV2 = {
          documentKinds: deriveDocumentKinds(v2Records),
          priorities: derivePriorities(v2Records),
          actionGroups: deriveActionGroups(v2Records),
          modulesCoverage: deriveModulesCoverage(v2Records),
          performance: derivePerformance(v2Records),
          topFindingCodes: deriveTopFindingCodes(v2Records),
          topModulesByFindings: deriveTopModulesByFindings(v2Records),
        };
      }

      const rangeFrom =
        records.length > 0
          ? records.reduce((a, b) => (a.createdAt < b.createdAt ? a : b)).createdAt.toISOString()
          : null;
      const rangeTo =
        records.length > 0
          ? records.reduce((a, b) => (a.createdAt > b.createdAt ? a : b)).createdAt.toISOString()
          : null;

      const analyzed = records.filter((r) => r.analysisStatus === "ANALYZED").length;
      const failed = records.filter((r) => r.analysisStatus === "FAILED").length;
      const individual = records.filter((r) => r.sourceType === "INDIVIDUAL").length;
      const zip = records.filter((r) => r.sourceType === "ZIP").length;

      const batchIds = new Set(records.filter((r) => r.batchId).map((r) => r.batchId!));
      const userIds = new Set(records.map((r) => r.userId));
      const orgIds = new Set(records.filter((r) => r.organizationId).map((r) => r.organizationId!));

      const riskCritical = records.filter((r) => r.riskLevel === "CRITICAL").length;
      const riskWarning = records.filter((r) => r.riskLevel === "WARNING").length;
      const riskOk = records.filter((r) => r.riskLevel === "OK").length;
      const riskNull = records.filter((r) => !r.riskLevel).length;

      const totalFindings = records.reduce((s, r) => s + r.findingsCount, 0);
      const totalCritical = records.reduce((s, r) => s + r.criticalCount, 0);
      const totalWarnings = records.reduce((s, r) => s + r.warningCount, 0);
      const totalInfo = records.reduce((s, r) => s + r.infoCount, 0);

      const withBom = records.filter((r) => r.hasBom).length;
      const withTechnicalNormalization = records.filter((r) => r.hasTechnicalNormalization).length;
      const withNormalizedXml = records.filter((r) => r.hasNormalizedXml).length;

      // Group by tipoComprobante
      const tipoMap = new Map<string, number>();
      for (const r of records) {
        if (r.tipoComprobante) {
          tipoMap.set(r.tipoComprobante, (tipoMap.get(r.tipoComprobante) ?? 0) + 1);
        }
      }
      const byTipoComprobante = Array.from(tipoMap.entries())
        .map(([tipoComprobante, count]) => ({ tipoComprobante, count }))
        .sort((a, b) => b.count - a.count);

      // Group by sourceType
      const sourceMap = new Map<string, number>();
      for (const r of records) {
        const st = r.sourceType ?? "UNKNOWN";
        sourceMap.set(st, (sourceMap.get(st) ?? 0) + 1);
      }
      const bySourceType = Array.from(sourceMap.entries())
        .map(([sourceType, count]) => ({ sourceType, count }))
        .sort((a, b) => b.count - a.count);

      // Group by analysisStatus
      const statusMap = new Map<string, number>();
      for (const r of records) {
        statusMap.set(r.analysisStatus, (statusMap.get(r.analysisStatus) ?? 0) + 1);
      }
      const byAnalysisStatus = Array.from(statusMap.entries())
        .map(([analysisStatus, count]) => ({ analysisStatus, count }))
        .sort((a, b) => b.count - a.count);

      // Top organizations
      const orgMap = new Map<
        string,
        {
          organizationName: string;
          records: number;
          failed: number;
          critical: number;
          withBom: number;
        }
      >();
      for (const r of records) {
        if (!r.organizationId) continue;
        const key = r.organizationId;
        const entry = orgMap.get(key);
        if (entry) {
          entry.records++;
          if (r.analysisStatus === "FAILED") entry.failed++;
          entry.critical += r.criticalCount;
          if (r.hasBom) entry.withBom++;
        } else {
          orgMap.set(key, {
            organizationName: r.organization?.name ?? "—",
            records: 1,
            failed: r.analysisStatus === "FAILED" ? 1 : 0,
            critical: r.criticalCount,
            withBom: r.hasBom ? 1 : 0,
          });
        }
      }
      const topOrganizations = Array.from(orgMap.entries())
        .map(([organizationId, data]) => ({ organizationId, ...data }))
        .sort((a, b) => b.records - a.records)
        .slice(0, 10);

      // Top users
      const userMap = new Map<
        string,
        { userEmail: string; records: number; failed: number; critical: number; withBom: number }
      >();
      for (const r of records) {
        const key = r.userId;
        const entry = userMap.get(key);
        if (entry) {
          entry.records++;
          if (r.analysisStatus === "FAILED") entry.failed++;
          entry.critical += r.criticalCount;
          if (r.hasBom) entry.withBom++;
        } else {
          userMap.set(key, {
            userEmail: r.user.email,
            records: 1,
            failed: r.analysisStatus === "FAILED" ? 1 : 0,
            critical: r.criticalCount,
            withBom: r.hasBom ? 1 : 0,
          });
        }
      }
      const topUsers = Array.from(userMap.entries())
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.records - a.records)
        .slice(0, 10);

      // Recent batches (deduplicate by batchId, keep first occurrence sorted by createdAt desc)
      const batchMap = new Map<
        string,
        {
          batchId: string;
          zipFilename: string;
          createdAt: Date;
          organizationName: string | null;
          userEmail: string;
          totalRecords: number;
          failed: number;
          critical: number;
        }
      >();
      for (const r of records) {
        if (!r.batchId) continue;
        const key = r.batchId;
        const entry = batchMap.get(key);
        if (entry) {
          entry.totalRecords++;
          if (r.analysisStatus === "FAILED") entry.failed++;
          entry.critical += r.criticalCount;
        } else {
          batchMap.set(key, {
            batchId: r.batchId,
            zipFilename: r.zipFilename ?? "—",
            createdAt: r.createdAt,
            organizationName: r.organization?.name ?? null,
            userEmail: r.user.email,
            totalRecords: 1,
            failed: r.analysisStatus === "FAILED" ? 1 : 0,
            critical: r.criticalCount,
          });
        }
      }
      const recentBatches = Array.from(batchMap.values())
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10)
        .map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }));

      return reply.send({
        range: { from: rangeFrom, to: rangeTo },
        totals: {
          records: records.length,
          analyzed,
          failed,
          individual,
          zip,
          uniqueBatches: batchIds.size,
          uniqueUsers: userIds.size,
          uniqueOrganizations: orgIds.size,
        },
        risk: {
          critical: riskCritical,
          warning: riskWarning,
          ok: riskOk,
          nullRisk: riskNull,
        },
        findings: {
          total: totalFindings,
          critical: totalCritical,
          warnings: totalWarnings,
          info: totalInfo,
        },
        technical: {
          withBom,
          withTechnicalNormalization,
          withNormalizedXml,
        },
        byTipoComprobante,
        bySourceType,
        byAnalysisStatus,
        topOrganizations,
        topUsers,
        recentBatches,
        analyticsV2,
      });
    },
  });

  fastify.get("/api/admin/plans", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const plans = await fastify.prisma.plan.findMany({
        orderBy: { key: "asc" },
        select: {
          key: true,
          name: true,
          description: true,
          monthlyPriceCents: true,
          yearlyPriceCents: true,
          currency: true,
          stripeMonthlyPriceId: true,
          stripeYearlyPriceId: true,
          features: true,
          maxUsers: true,
          maxRfcProfiles: true,
          monthlyUsageLimit: true,
          isPublic: true,
        },
      });

      return reply.send({ plans });
    },
  });

  fastify.patch("/api/admin/plans/:planKey", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.code(403).send({
          error: { code: "FORBIDDEN", message: "Acceso denegado. Se requiere rol SUPER_ADMIN." },
        });
      }

      const { planKey } = request.params as { planKey: string };

      const parseResult = adminUpdatePlanSchema.safeParse(request.body);

      if (!parseResult.success) {
        const firstMessage = parseResult.error.errors[0]?.message ?? "Datos de entrada inválidos";
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: firstMessage },
        });
      }

      const existing = await fastify.prisma.plan.findUnique({
        where: { key: planKey },
        select: { id: true },
      });

      if (!existing) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: `Plan ${planKey} no encontrado.` },
        });
      }

      await fastify.prisma.plan.update({
        where: { key: planKey },
        data: parseResult.data,
      });

      fastify.log.info({ planKey, updates: parseResult.data }, "Plan updated by admin");

      return reply.send({
        ok: true,
        message: `Plan ${planKey} actualizado correctamente`,
      });
    },
  });
}
