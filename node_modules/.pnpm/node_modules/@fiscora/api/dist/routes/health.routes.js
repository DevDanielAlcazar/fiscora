export async function healthRoutes(fastify) {
    fastify.get("/health", async (request, reply) => {
        return { status: "OK", timestamp: new Date().toISOString() };
    });
}
//# sourceMappingURL=health.routes.js.map