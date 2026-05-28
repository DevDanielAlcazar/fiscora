export async function versionRoutes(fastify) {
    fastify.get("/api/version", async (request, reply) => {
        return {
            name: "Fiscora API",
            version: "1.0.0",
            environment: process.env.NODE_ENV || "development",
        };
    });
}
//# sourceMappingURL=version.routes.js.map