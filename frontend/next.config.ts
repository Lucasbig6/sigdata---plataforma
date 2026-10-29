import path from "node:path";
import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

/** API do SIGDATA (pasta /backend). O navegador só fala com o Next, na mesma origem. */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // raiz do monorepo: permite importar ../shared
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  experimental: {
    // O proxy dos rewrites derruba a conexão após 30 s sem dados (padrão). O chat
    // fica mudo entre etapas enquanto espera o limite de tokens/minuto da Groq.
    proxyTimeout: 5 * 60 * 1000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default withAui(nextConfig);
