import { PrismaClient } from "@prisma/client";

export interface ModulePermissions {
  allowSingleXml: boolean;
  allowZip: boolean;
  consumesUsage: boolean;
  beta: boolean;
}

interface AssertModuleAccessParams {
  prisma: PrismaClient;
  organizationId: string;
  moduleKey: string;
}

export class ModuleAccessService {
  static async assertModuleAccess(params: AssertModuleAccessParams): Promise<ModulePermissions> {
    const { prisma, organizationId, moduleKey } = params;

    const mod = await prisma.module.findUnique({
      where: { key: moduleKey },
      select: { id: true },
    });

    if (!mod) {
      throw Object.assign(new Error(`Módulo ${moduleKey} no encontrado`), {
        code: "MODULE_NOT_FOUND",
      });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        planId: true,
      },
    });

    if (!subscription) {
      throw new Error("No se encontró una suscripción activa para la organización");
    }

    const access = await prisma.planModuleAccess.findUnique({
      where: {
        planId_moduleId: {
          planId: subscription.planId,
          moduleId: mod.id,
        },
      },
      select: {
        enabled: true,
        adminOnly: true,
        allowSingleXml: true,
        allowZip: true,
        consumesUsage: true,
        beta: true,
      },
    });

    if (!access || !access.enabled || access.adminOnly) {
      throw Object.assign(new Error(`Acceso denegado al módulo ${moduleKey}`), {
        code: "MODULE_NOT_ALLOWED",
      });
    }

    return {
      allowSingleXml: access.allowSingleXml,
      allowZip: access.allowZip,
      consumesUsage: access.consumesUsage,
      beta: access.beta,
    };
  }
}
