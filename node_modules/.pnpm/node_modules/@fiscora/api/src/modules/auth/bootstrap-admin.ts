import { PasswordService } from "./password.service.js";

export class BootstrapAdmin {
  static async createAdminIfNotExists(fastify: any): Promise<void> {
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    // Check if required environment variables are set
    if (!adminEmail || !adminPassword) {
      console.log("⚠️ Bootstrap admin: Missing environment variables. Skipping admin creation.");
      return;
    }

    try {
      // Check if admin user already exists
      const existingAdmin = await fastify.prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (existingAdmin) {
        console.log("✅ Bootstrap admin: Admin user already exists. Skipping creation.");
        return;
      }

      // Hash the admin password
      const passwordHash = await PasswordService.hashPassword(adminPassword);

      // Create the admin user
      const adminUser = await fastify.prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: "Admin Principal",
          role: "SUPER_ADMIN",
        },
      });

      console.log("✅ Bootstrap admin: Admin user created successfully:", adminUser.email);
    } catch (error) {
      console.error(
        "❌ Bootstrap admin: Failed to create admin user:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }
}
