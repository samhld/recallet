import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Manually parse the URL to work around a suspected drizzle-kit bug
const url = new URL(process.env.DATABASE_URL);

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./shared/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1), // remove leading '/'
    ssl: {
      rejectUnauthorized: false,
    },
  },
  verbose: true,
  strict: true,
});
