import path from "node:path";
import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

/** API do SIGDATA (pasta /backend). O navegador só fala com o Next, na mesma origem. */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

/** Cabeçalhos de segurança para todas as páginas (a CSP fica para uma etapa própria: exige nonces no Next). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // imagem Docker enxuta (server.js autônomo)
  output: "standalone",
  poweredByHeader: false,
  // raiz do monorepo: permite importar ../shared
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default withAui(nextConfig);
