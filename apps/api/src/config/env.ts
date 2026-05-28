import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the monorepo root (apps/api/src/config → 4 levels up)
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/fiscora?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  API_PORT: z.coerce.number().default(4016),
  API_URL: z.string().default("http://localhost:4000"),
  WEB_URL: z.string().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32).default("dev-jwt-access-secret-change-me"),
  JWT_REFRESH_SECRET: z.string().default("dev-jwt-refresh-secret-change-me"),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_PRICE_ESSENTIAL_MONTHLY: z.string().default("price_placeholder"),
  STRIPE_PRICE_PROFESSIONAL_MONTHLY: z.string().default("price_placeholder"),
  STRIPE_PRICE_CORPORATION_MONTHLY: z.string().default("price_placeholder"),
  STRIPE_PRICE_FORENSIC_AUDITOR_MONTHLY: z.string().default("price_placeholder"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  CLOUDFLARE_PUBLIC_DOMAIN: z.string().default("fiscora.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
