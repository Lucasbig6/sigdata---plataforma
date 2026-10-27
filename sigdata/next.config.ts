import { withAui } from "@assistant-ui/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Módulos nativos usados só no servidor (motor analítico e drivers).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings", "pg", "exceljs"],
};

export default withAui(nextConfig);
