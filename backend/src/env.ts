/** Carrega `.env` (se existir) antes de qualquer módulo ler process.env. */
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
