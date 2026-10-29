/**
 * Cria o primeiro administrador (o cadastro público é desligado) ou promove uma
 * conta existente a admin.
 *
 *   npm run admin:create -- <email> <senha> [nome]
 */
import "../env";
import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { db, schema } from "../db";

const [email, password, ...nameParts] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: npm run admin:create -- <email> <senha> [nome]");
  process.exit(1);
}

const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email.toLowerCase()));

if (existing) {
  await db.update(schema.user).set({ role: "admin", banned: false }).where(eq(schema.user.id, existing.id));
  console.log(`[sigdata] ${existing.email} agora é administrador (senha mantida).`);
} else {
  // Sem headers = chamada do servidor: o plugin admin permite criar sem sessão.
  const { user } = await auth.api.createUser({
    body: { email, password, name: nameParts.join(" ") || "Administrador", role: "admin" },
  });
  console.log(`[sigdata] administrador ${user.email} criado.`);
}

process.exit(0);
