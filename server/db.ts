import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Singleton pool to prevent multiple WebSocket connections
let globalPool: Pool | null = null;

export function getPool(): Pool {
  if (!globalPool) {
    globalPool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 1, // Limit to single connection for serverless
    });
  }
  return globalPool;
}

export const pool = getPool();
export const db = drizzle({ client: pool, schema });

// Cleanup function for graceful shutdown
export async function closePool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}