import { PrismaClient } from "@prisma/client";

interface RegisterUsageParams {
  prisma: PrismaClient;
  organizationId: string;
  userId: string;
  moduleKey: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export class UsageService {
  static async registerUsage(params: RegisterUsageParams): Promise<void> {
    const { prisma, organizationId, moduleKey, action } = params;

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        plan: {
          select: {
            monthlyUsageLimit: true,
          },
        },
      },
    });

    if (!subscription) {
      throw new Error("No se encontró una suscripción activa para la organización");
    }

    const limit = subscription.plan.monthlyUsageLimit;

    if (limit !== null) {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const used = await prisma.usageEvent.count({
        where: {
          organizationId,
          timestamp: { gte: from, lt: to },
        },
      });

      if (used >= limit) {
        throw Object.assign(new Error("Límite de uso mensual alcanzado"), {
          code: "USAGE_LIMIT_EXCEEDED",
          used,
          limit,
        });
      }
    }

    await prisma.usageEvent.create({
      data: {
        organizationId,
        eventType: action,
        quantity: 1,
        description: `Módulo: ${moduleKey}`,
        timestamp: new Date(),
      },
    });
  }
}
