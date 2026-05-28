import { FastifyPluginAsync } from "fastify";
import { PrismaClient } from "@prisma/client";
declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
//# sourceMappingURL=prisma.plugin.d.ts.map