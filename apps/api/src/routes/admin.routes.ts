import { FastifyInstance } from "fastify";

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
}
