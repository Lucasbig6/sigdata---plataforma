import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sigdataPool?: Pool };

// Reaproveita o pool entre hot reloads do `next dev`.
const pool =
  globalForDb.sigdataPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

if (process.env.NODE_ENV !== "production") globalForDb.sigdataPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
