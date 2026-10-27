import type { NumberFormat } from "@shared/charts/types";

export const formatNumber = (value: number | null, format: NumberFormat = "numero", decimals = 1) => {
  if (value === null) return "—";
  const digits = Math.min(Math.max(decimals, 0), 4);
  switch (format) {
    case "moeda":
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: digits,
        minimumFractionDigits: Math.min(digits, 2),
      }).format(value);
    case "percentual":
      return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value)}%`;
    case "compacto":
      return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: digits }).format(value);
    default:
      return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
  }
};

