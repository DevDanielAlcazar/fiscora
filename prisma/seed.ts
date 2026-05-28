import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding plans...");

  const plans = [
    {
      key: "ESSENTIAL",
      name: "Essential",
      stripePriceId: "price_essential",
      maxUsers: 1,
      maxRfcProfiles: 1,
    },
    {
      key: "PROFESSIONAL",
      name: "Profesional",
      stripePriceId: "price_professional",
      maxUsers: 5,
      maxRfcProfiles: 20,
    },
    {
      key: "CORPORATION",
      name: "Corporativo",
      stripePriceId: "price_corporation",
      maxUsers: 20,
      maxRfcProfiles: 100,
    },
    {
      key: "FORENSIC_AUDITOR",
      name: "Auditor Forense",
      stripePriceId: "price_forensic_auditor",
      maxUsers: 1,
      maxRfcProfiles: 999,
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        stripePriceId: plan.stripePriceId,
        maxUsers: plan.maxUsers,
        maxRfcProfiles: plan.maxRfcProfiles,
      },
      create: plan,
    });
    console.log(`  ✅ Plan ${plan.key} — ${plan.name}`);
  }

  console.log("🌱 Seeding modules...");

  const modules = [
    { key: "AUDITORIA_XML", name: "Auditoría XML", description: "Módulo de auditoría y análisis de XML contables" },
    { key: "LABORAL", name: "Laboral", description: "Módulo de cálculos laborales mexicanos" },
    { key: "ADMIN_STRIPE_WEBHOOK", name: "Admin Stripe Webhook", description: "Gestión de webhooks de Stripe" },
    { key: "ADMIN_USERS", name: "Admin Usuarios", description: "Administración de usuarios del sistema" },
    { key: "ADMIN_MODULES", name: "Admin Módulos", description: "Administración de módulos del sistema" },
    { key: "ADMIN_ANALYTICS", name: "Admin Analytics", description: "Analíticas y reportes del sistema" },
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
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
