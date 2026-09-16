import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: "../../.env" });
loadEnv({ path: ".env", override: true });

if (process.env.COMERCIA_DATABASE_TARGET === "production") {
  loadEnv({ path: "../../.env.production.local", override: true });
} else if (process.env.NODE_ENV !== "production") {
  loadEnv({ path: "../../.env.development", override: true });
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
