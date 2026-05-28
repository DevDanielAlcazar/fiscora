import { FastifyInstance } from "fastify";

export async function dbHealthRoutes(fastify: FastifyInstance) {
  fastify.get("/api/db/health", async (request, reply) => {
    try {
      // Execute a minimal safe query to check the database connection
      await fastify.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        database: "connected",
      };
    } catch (error) {
      fastify.log.error(error, "Fallo al verificar la conexión a la base de datos");
      
      // Respond with a controlled message without exposing credentials or internal Prisma errors
      return reply.status(500).send({
        success: false,
        error: {
          code: "DATABASE_CONNECTION_ERROR",
          message: "No se pudo establecer conexión con la base de datos",
          statusCode: 500,
        },
      });
    }
  });
}
