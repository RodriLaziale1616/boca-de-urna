import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), override: false });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  ADMIN_NAME: z.string().optional(),
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  PUBLIC_APP_NAME: z.string().default("Boca de Urna")
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
