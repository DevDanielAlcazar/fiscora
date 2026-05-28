import { FastifyInstance } from "fastify";

export async function versionRoutes(fastify: FastifyInstance) {
  fastify.get("/api/version", async (request, reply) => {
    return {
      name: "Fiscora API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };
  });
}
