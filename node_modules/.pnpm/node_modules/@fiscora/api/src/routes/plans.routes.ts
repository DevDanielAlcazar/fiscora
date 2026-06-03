import { FastifyInstance } from "fastify";

const PLAN_ORDER: Record<string, number> = {
  ESSENTIAL: 0,
  PROFESSIONAL: 1,
  CORPORATION: 2,
  FORENSIC_AUDITOR: 3,
};

export async function planRoutes(fastify: FastifyInstance) {
  fastify.get("/api/plans", async (_request, reply) => {
    const plans = await fastify.prisma.plan.findMany({
      where: { isPublic: true },
      select: {
        key: true,
        name: true,
        description: true,
        monthlyPriceCents: true,
        yearlyPriceCents: true,
        currency: true,
        features: true,
        maxRfcProfiles: true,
        maxUsers: true,
        monthlyUsageLimit: true,
      },
    });

    plans.sort((a, b) => (PLAN_ORDER[a.key] ?? 99) - (PLAN_ORDER[b.key] ?? 99));

    return reply.send({ plans });
  });
}
