import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
// Cache the client in development to avoid exhausting connection limits on hot reloads
const globalForPrisma = globalThis;
const prismaPlugin = async (fastify) => {
    const prisma = globalForPrisma.prisma ?? new PrismaClient();
    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = prisma;
    }
    // Prisma connects lazily on the first query — no eager $connect() here.
    // This lets the server boot even when the database is unreachable.
    // The /api/db/health route is responsible for probing the connection.
    fastify.decorate("prisma", prisma);
    fastify.addHook("onClose", async (server) => {
        server.log.info("Desconectando Prisma...");
        await server.prisma.$disconnect();
    });
};
export default fp(prismaPlugin, {
    name: "prisma-plugin",
});
//# sourceMappingURL=prisma.plugin.js.map