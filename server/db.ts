import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// --- connection ------------------------------------------------------------
// Prefer a full DATABASE_URL (works for TiDB Cloud / PlanetScale / Render, etc.)
// Example: mysql://user:pass@host:4000/dbname
// When DATABASE_URL isn't set we fall back to individual DB_* env vars so local
// `docker compose up mysql` still works.

const poolConfig = process.env.DATABASE_URL
  ? {
      uri: process.env.DATABASE_URL,
      ssl: {
        // TiDB Cloud / PlanetScale require TLS but do not provide CA chain by default.
        rejectUnauthorized: false,
      },
      // pool-tuning overrides are still allowed via env vars
      connectionLimit: 10,
    }
  : {
      connectionLimit: 10,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || undefined,
      database: process.env.DB_NAME || 'recallet',
    } as const;

export const pool = mysql.createPool(poolConfig as any);

export const db = drizzle(pool, { schema, mode: 'default' });

// Gracefully close the pool (used in SIGINT/SIGTERM handlers)
export async function closePool() {
  await pool.end();
}