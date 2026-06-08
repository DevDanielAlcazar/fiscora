import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { healthRoutes } from "./routes/health.routes.js";
import { versionRoutes } from "./routes/version.routes.js";
import prismaPlugin from "./plugins/prisma.plugin.js";
import { dbHealthRoutes } from "./routes/db-health.routes.js";
import { BootstrapAdmin } from "./modules/auth/bootstrap-admin.js";
import { cleanupExpiredXmlAnalysisRecords } from "./modules/xml-audit/xml-analysis-cleanup.service.js";
import { jwtPlugin } from "./plugins/jwt.plugin.js";
import { authenticatePlugin } from "./plugins/authenticate.plugin.js";
import { authRoutes } from "./routes/auth.routes.js";
import { stripeWebhookRoutes } from "./routes/stripe-webhooks.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { billingRoutes } from "./routes/billing.routes.js";
import { moduleRoutes } from "./routes/modules.routes.js";
import { usageRoutes } from "./routes/usage.routes.js";
import { planRoutes } from "./routes/plans.routes.js";
import { xmlAuditRoutes } from "./routes/xml-audit.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: true,
  });

  // Enable CORS for frontend integration
  await app.register(cors, {
    origin: true, // Echoes back request origin, ideal for development
    credentials: true,
  });

  // Register plugins
  await app.register(jwtPlugin);
  await app.register(authenticatePlugin);
  await app.register(prismaPlugin);
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  // Bootstrap admin after Prisma is connected
  await BootstrapAdmin.createAdminIfNotExists(app);

  // Periodic cleanup of expired XmlAnalysisRecord (retention: 24h)
  app.addHook("onReady", async () => {
    try {
      const deleted = await cleanupExpiredXmlAnalysisRecords(app.prisma);
      app.log.info(`XmlAnalysisRecord cleanup on startup: ${deleted} expired record(s) deleted`);
    } catch (err) {
      app.log.error(err, "XmlAnalysisRecord cleanup on startup failed");
    }

    const intervalMs = 60 * 60 * 1000;
    const intervalId = setInterval(async () => {
      try {
        const deleted = await cleanupExpiredXmlAnalysisRecords(app.prisma);
        if (deleted > 0) {
          app.log.info(`XmlAnalysisRecord periodic cleanup: ${deleted} expired record(s) deleted`);
        }
      } catch (err) {
        app.log.error(err, "XmlAnalysisRecord periodic cleanup failed");
      }
    }, intervalMs);

    app.addHook("onClose", (_instance, done) => {
      clearInterval(intervalId);
      done();
    });
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(versionRoutes);
  await app.register(dbHealthRoutes);
  await app.register(authRoutes);
  await app.register(stripeWebhookRoutes);
  await app.register(adminRoutes);
  await app.register(billingRoutes);
  await app.register(moduleRoutes);
  await app.register(usageRoutes);
  await app.register(planRoutes);
  await app.register(xmlAuditRoutes);

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || "INTERNAL_SERVER_ERROR",
        message: isClientError ? error.message : "Ocurrió un error interno en el servidor",
        statusCode,
      },
    });
  });

  return app;
}
