import { FastifyInstance } from "fastify";
import { ModuleAccessService } from "../modules/modules/module-access.service.js";
import { UsageService } from "../modules/usage/usage.service.js";
import { analyzeCfdi, toAnalysisResponse } from "../modules/xml-audit/xml-audit.service.js";
import { XmlAnalysisRecordService } from "../modules/xml-audit/xml-analysis-record.service.js";

const MODULE_KEY = "AUDITORIA_XML";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSION = ".xml";

export async function xmlAuditRoutes(fastify: FastifyInstance) {
  fastify.post("/api/modules/xml-audit/analyze", {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      if (!request.user.organizationId) {
        return reply.code(400).send({
          error: { code: "BAD_REQUEST", message: "La cuenta no tiene organización asociada" },
        });
      }

      // Validate module access
      let modulePermissions: { consumesUsage: boolean; allowSingleXml: boolean };
      try {
        modulePermissions = await ModuleAccessService.assertModuleAccess({
          prisma: fastify.prisma,
          organizationId: request.user.organizationId,
          moduleKey: MODULE_KEY,
        });
      } catch (err: unknown) {
        const error = err as { code?: string; message: string };
        if (error.code === "MODULE_NOT_ALLOWED") {
          return reply.code(403).send({
            error: { code: "MODULE_NOT_ALLOWED", message: "No tienes acceso al módulo de Auditoría XML." },
          });
        }
        if (error.code === "MODULE_NOT_FOUND") {
          return reply.code(404).send({
            error: { code: "MODULE_NOT_FOUND", message: "Módulo no encontrado." },
          });
        }
        return reply.code(500).send({
          error: { code: "INTERNAL_ERROR", message: error.message },
        });
      }

      if (!modulePermissions.allowSingleXml) {
        return reply.code(403).send({
          error: { code: "MODULE_NOT_ALLOWED", message: "Tu plan no permite el análisis de XML individual." },
        });
      }

      // Parse multipart file
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({
          error: { code: "FILE_REQUIRED", message: "Debes enviar un archivo XML." },
        });
      }

      const filename = file.filename.toLowerCase();
      if (!filename.endsWith(ALLOWED_EXTENSION)) {
        return reply.code(400).send({
          error: { code: "INVALID_FILE_TYPE", message: "Solo se permiten archivos XML." },
        });
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of file.file) {
        totalSize += chunk.length;
        if (totalSize > MAX_FILE_SIZE) {
          return reply.code(400).send({
            error: { code: "FILE_TOO_LARGE", message: "El archivo excede el tamaño máximo de 5 MB." },
          });
        }
        chunks.push(chunk);
      }

      if (chunks.length === 0) {
        return reply.code(400).send({
          error: { code: "FILE_REQUIRED", message: "El archivo está vacío." },
        });
      }

      const xmlContent = Buffer.concat(chunks).toString("utf-8");

      // Analyze XML
      let result;
      try {
        result = analyzeCfdi(xmlContent, file.filename);
      } catch (err: unknown) {
        const error = err as { code?: string; message: string };
        if (error.code === "XML_INVALID") {
          return reply.code(400).send({
            error: { code: "XML_INVALID", message: error.message },
          });
        }
        return reply.code(500).send({
          error: { code: "INTERNAL_ERROR", message: "Error al analizar el XML." },
        });
      }

      // Register usage
      if (modulePermissions.consumesUsage) {
        try {
          await UsageService.registerUsage({
            prisma: fastify.prisma,
            organizationId: request.user.organizationId,
            userId: request.user.userId,
            moduleKey: MODULE_KEY,
            action: "XML_AUDIT_ANALYZE",
          });
        } catch (err: unknown) {
          const error = err as { code?: string; message: string };
          if (error.code === "USAGE_LIMIT_EXCEEDED") {
            return reply.code(403).send({
              error: { code: "USAGE_LIMIT_EXCEEDED", message: "Has alcanzado el límite mensual de usos." },
            });
          }
          return reply.code(500).send({
            error: { code: "INTERNAL_ERROR", message: error.message },
          });
        }
      }

      const analysisResponse = toAnalysisResponse(result);

      // Save analysis record (non-blocking — failure does not break response)
      try {
        await XmlAnalysisRecordService.saveXmlAnalysisRecord({
          prisma: fastify.prisma,
          userId: request.user.userId,
          organizationId: request.user.organizationId,
          analysis: analysisResponse,
        });
      } catch (saveError: unknown) {
        fastify.log.error(
          { error: saveError, userId: request.user.userId },
          "Failed to save XmlAnalysisRecord",
        );
      }

      fastify.log.info(
        { organizationId: request.user.organizationId, uuid: result.uuid },
        "XML analyzed successfully",
      );

      return reply.send({
        ok: true,
        analysis: analysisResponse,
      });
    },
  });
}
