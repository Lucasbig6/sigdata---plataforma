/**
 * Qualidade dos dados a partir do perfil das colunas (já calculado no backend).
 * Determinístico de propósito: não depende da IA e nunca inventa um problema.
 */
import type { SourceTable } from "@shared/domain/sources";

export type QualityIssue = {
  table: string;
  column: string | null;
  severity: "alerta" | "atencao" | "info";
  message: string;
};

const ID_NAME = /(^|_)(id|cod|codigo|código|cpf|cnpj)($|_)/i;
const nf = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const analyzeQuality = (tables: SourceTable[]): QualityIssue[] => {
  const issues: QualityIssue[] = [];
  for (const table of tables) {
    const rows = table.rowCount ?? 0;
    if (rows === 0) {
      issues.push({ table: table.name, column: null, severity: "alerta", message: "A tabela não tem linhas." });
      continue;
    }
    for (const column of table.columns) {
      const profile = column.profile;
      if (!profile) continue;
      if (profile.nulosPct >= 50) {
        issues.push({ table: table.name, column: column.name, severity: "alerta", message: `${nf.format(profile.nulosPct)}% dos valores estão vazios.` });
      } else if (profile.nulosPct >= 5) {
        issues.push({ table: table.name, column: column.name, severity: "atencao", message: `${nf.format(profile.nulosPct)}% dos valores estão vazios.` });
      }
      if (rows > 1 && profile.distintos === 1 && profile.nulosPct < 100) {
        issues.push({ table: table.name, column: column.name, severity: "info", message: "Tem um único valor em todas as linhas: não ajuda a separar nada." });
      }
      if (ID_NAME.test(column.name) && profile.distintos != null && profile.distintos < rows && profile.nulosPct < 100) {
        issues.push({
          table: table.name,
          column: column.name,
          severity: "atencao",
          message: `Parece um identificador, mas tem ${nf.format(rows - profile.distintos)} valor(es) repetido(s).`,
        });
      }
    }
  }
  const rank = { alerta: 0, atencao: 1, info: 2 } as const;
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
};
