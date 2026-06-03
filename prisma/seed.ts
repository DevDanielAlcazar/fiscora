import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding plans...");

  const plans = [
    {
      key: "ESSENTIAL",
      name: "Essential",
      description: "Plan básico para empezar con auditoría XML",
      stripePriceId: "price_essential",
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      stripeMonthlyPriceId: null,
      stripeYearlyPriceId: null,
      features: ["1 RFC", "20 usos mensuales", "Auditoría XML individual"],
      isPublic: true,
      maxUsers: 1,
      maxRfcProfiles: 1,
      monthlyUsageLimit: 20,
    },
    {
      key: "PROFESSIONAL",
      name: "Profesional",
      description: "Plan profesional para despachos contables",
      stripePriceId: "price_professional",
      monthlyPriceCents: 39900,
      yearlyPriceCents: 359100,
      stripeMonthlyPriceId: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY ?? null,
      stripeYearlyPriceId: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY ?? null,
      features: ["Hasta 5 usuarios", "20 RFCs", "Auditoría XML masiva", "Módulo laboral"],
      isPublic: true,
      maxUsers: 5,
      maxRfcProfiles: 20,
      monthlyUsageLimit: null,
    },
    {
      key: "CORPORATION",
      name: "Corporativo",
      description: "Plan corporativo para empresas",
      stripePriceId: "price_corporation",
      monthlyPriceCents: 140000,
      yearlyPriceCents: 1260000,
      stripeMonthlyPriceId: process.env.STRIPE_PRICE_CORPORATION_MONTHLY ?? null,
      stripeYearlyPriceId: process.env.STRIPE_PRICE_CORPORATION_YEARLY ?? null,
      features: ["Hasta 20 usuarios", "100 RFCs", "Auditoría XML masiva", "Módulo laboral", "Soporte prioritario"],
      isPublic: true,
      maxUsers: 20,
      maxRfcProfiles: 100,
      monthlyUsageLimit: null,
    },
    {
      key: "FORENSIC_AUDITOR",
      name: "Auditor Forense",
      description: "Plan especializado para auditores forenses",
      stripePriceId: "price_forensic_auditor",
      monthlyPriceCents: 418900,
      yearlyPriceCents: 3770100,
      stripeMonthlyPriceId: process.env.STRIPE_PRICE_FORENSIC_AUDITOR_MONTHLY ?? null,
      stripeYearlyPriceId: process.env.STRIPE_PRICE_FORENSIC_AUDITOR_YEARLY ?? null,
      features: ["1 usuario", "RFCs ilimitados", "Auditoría XML masiva", "Módulo laboral", "Soporte 24/7"],
      isPublic: true,
      maxUsers: 1,
      maxRfcProfiles: 999,
      monthlyUsageLimit: null,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        stripePriceId: plan.stripePriceId,
        monthlyPriceCents: plan.monthlyPriceCents,
        yearlyPriceCents: plan.yearlyPriceCents,
        stripeMonthlyPriceId: plan.stripeMonthlyPriceId,
        stripeYearlyPriceId: plan.stripeYearlyPriceId,
        features: plan.features,
        isPublic: plan.isPublic,
        maxUsers: plan.maxUsers,
        maxRfcProfiles: plan.maxRfcProfiles,
        monthlyUsageLimit: plan.monthlyUsageLimit,
      },
      create: plan,
    });
    console.log(`  ✅ Plan ${plan.key} — ${plan.name}`);
  }

  console.log("🌱 Seeding modules...");

  const modules = [
    {
      key: "AUDITORIA_XML",
      name: "Auditoría XML",
      description: "Módulo de auditoría y análisis de XML contables",
    },
    { key: "LABORAL", name: "Laboral", description: "Módulo de cálculos laborales mexicanos" },
    {
      key: "ADMIN_STRIPE_WEBHOOK",
      name: "Admin Stripe Webhook",
      description: "Gestión de webhooks de Stripe",
    },
    {
      key: "ADMIN_USERS",
      name: "Admin Usuarios",
      description: "Administración de usuarios del sistema",
    },
    {
      key: "ADMIN_MODULES",
      name: "Admin Módulos",
      description: "Administración de módulos del sistema",
    },
    {
      key: "ADMIN_ANALYTICS",
      name: "Admin Analytics",
      description: "Analíticas y reportes del sistema",
    },
  ];

  for (const mod of modules) {
    await prisma.module.upsert({
      where: { key: mod.key },
      update: {
        name: mod.name,
        description: mod.description,
      },
      create: mod,
    });
    console.log(`  ✅ Module ${mod.key} — ${mod.name}`);
  }

  console.log("🌱 Seeding plan-module access...");

  interface PlanModuleSeed {
    moduleKey: string;
    planKey: string;
    enabled: boolean;
    adminOnly?: boolean;
    beta?: boolean;
    consumesUsage?: boolean;
    allowSingleXml?: boolean;
    allowZip?: boolean;
  }

  const accessRules: PlanModuleSeed[] = [
    // AUDITORIA_XML
    { moduleKey: "AUDITORIA_XML", planKey: "ESSENTIAL", enabled: true, allowSingleXml: true, allowZip: false },
    { moduleKey: "AUDITORIA_XML", planKey: "PROFESSIONAL", enabled: true, allowSingleXml: true, allowZip: true },
    { moduleKey: "AUDITORIA_XML", planKey: "CORPORATION", enabled: true, allowSingleXml: true, allowZip: true },
    { moduleKey: "AUDITORIA_XML", planKey: "FORENSIC_AUDITOR", enabled: true, allowSingleXml: true, allowZip: true },
    // LABORAL
    { moduleKey: "LABORAL", planKey: "ESSENTIAL", enabled: false },
    { moduleKey: "LABORAL", planKey: "PROFESSIONAL", enabled: true },
    { moduleKey: "LABORAL", planKey: "CORPORATION", enabled: true },
    { moduleKey: "LABORAL", planKey: "FORENSIC_AUDITOR", enabled: true },
    // ADMIN modules — all adminOnly
    { moduleKey: "ADMIN_STRIPE_WEBHOOK", planKey: "ESSENTIAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_STRIPE_WEBHOOK", planKey: "PROFESSIONAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_STRIPE_WEBHOOK", planKey: "CORPORATION", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_STRIPE_WEBHOOK", planKey: "FORENSIC_AUDITOR", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_USERS", planKey: "ESSENTIAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_USERS", planKey: "PROFESSIONAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_USERS", planKey: "CORPORATION", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_USERS", planKey: "FORENSIC_AUDITOR", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_MODULES", planKey: "ESSENTIAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_MODULES", planKey: "PROFESSIONAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_MODULES", planKey: "CORPORATION", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_MODULES", planKey: "FORENSIC_AUDITOR", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_ANALYTICS", planKey: "ESSENTIAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_ANALYTICS", planKey: "PROFESSIONAL", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_ANALYTICS", planKey: "CORPORATION", enabled: true, adminOnly: true, consumesUsage: false },
    { moduleKey: "ADMIN_ANALYTICS", planKey: "FORENSIC_AUDITOR", enabled: true, adminOnly: true, consumesUsage: false },
  ];

  for (const rule of accessRules) {
    const plan = await prisma.plan.findUnique({ where: { key: rule.planKey }, select: { id: true } });
    const mod = await prisma.module.findUnique({ where: { key: rule.moduleKey }, select: { id: true } });

    if (!plan || !mod) {
      console.log(`  ⚠️  Plan ${rule.planKey} or Module ${rule.moduleKey} not found, skipping`);
      continue;
    }

    await prisma.planModuleAccess.upsert({
      where: { planId_moduleId: { planId: plan.id, moduleId: mod.id } },
      update: {
        enabled: rule.enabled,
        adminOnly: rule.adminOnly ?? false,
        beta: rule.beta ?? false,
        consumesUsage: rule.consumesUsage ?? true,
        allowSingleXml: rule.allowSingleXml ?? false,
        allowZip: rule.allowZip ?? false,
      },
      create: {
        planId: plan.id,
        moduleId: mod.id,
        enabled: rule.enabled,
        adminOnly: rule.adminOnly ?? false,
        beta: rule.beta ?? false,
        consumesUsage: rule.consumesUsage ?? true,
        allowSingleXml: rule.allowSingleXml ?? false,
        allowZip: rule.allowZip ?? false,
      },
    });
    console.log(`  ✅ ${rule.planKey} → ${rule.moduleKey}: enabled=${rule.enabled}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
