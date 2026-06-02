import { FastifyInstance } from "fastify";

export async function moduleRoutes(fastify: FastifyInstance) {
  fastify.get("/api/modules/available", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (request.user.role === "SUPER_ADMIN") {
        const allModules = await fastify.prisma.module.findMany({
          select: {
            key: true,
            name: true,
            description: true,
          },
        });

        const modules = allModules.map((mod) => ({
          key: mod.key,
          name: mod.name,
          description: mod.description ?? null,
          enabled: true,
          beta: false,
          consumesUsage: false,
          allowSingleXml: false,
          allowZip: false,
        }));

        return reply.send({ modules });
      }

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
              moduleAccess: {
                where: { enabled: true, adminOnly: false },
                select: {
                  enabled: true,
                  beta: true,
                  consumesUsage: true,
                  allowSingleXml: true,
                  allowZip: true,
                  module: {
                    select: {
                      key: true,
                      name: true,
                      description: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!subscription) {
        return reply.send({ modules: [] });
      }

      const modules = subscription.plan.moduleAccess.map((access) => ({
        key: access.module.key,
        name: access.module.name,
        description: access.module.description ?? null,
        enabled: access.enabled,
        beta: access.beta,
        consumesUsage: access.consumesUsage,
        allowSingleXml: access.allowSingleXml,
        allowZip: access.allowZip,
      }));

      return reply.send({ modules });
    },
  });
}
