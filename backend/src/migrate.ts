import "./env";
import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./db";

/** Aplica as migrações pendentes (usado no deploy; em desenvolvimento use `npm run db:migrate`). */
await migrate(db, { migrationsFolder: path.resolve("drizzle") });
console.log("[sigdata] migrações aplicadas");
process.exit(0);
