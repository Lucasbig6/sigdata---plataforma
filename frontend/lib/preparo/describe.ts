import { AGG_LABELS, DATE_PART_LABELS, type FilterOp, type Step } from "@/lib/domain/transform";

const OP_LABELS: Record<FilterOp, string> = {
  "=": "=",
  "!=": "≠",
  ">": ">",
  ">=": "≥",
  "<": "<",
  "<=": "≤",
  contem: "contém",
  nulo: "é nulo",
  nao_nulo: "não é nulo",
};

export const OP_CHOICES = Object.entries(OP_LABELS) as [FilterOp, string][];

/** Texto entre aspas; números digitados e valores lógicos aparecem como estão. */
const quoted = (value: string | number | boolean | undefined) =>
  typeof value === "string" && !/^-?\d+([.,]\d+)?$/.test(value) && value !== "true" && value !== "false" ? `"${value}"` : String(value ?? "");

const list = (names: string[], empty = "todas as colunas") =>
  names.length === 0 ? empty : names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} e mais ${names.length - 3}`;

/** Resumo de uma linha da etapa, para a lista "Etapas aplicadas". */
export const describeStep = (step: Step): string => {
  switch (step.type) {
    case "filtrar":
      return step.op === "nulo" || step.op === "nao_nulo"
        ? `${step.column} ${OP_LABELS[step.op]}`
        : `${step.column} ${OP_LABELS[step.op]} ${quoted(step.value)}`;
    case "renomear":
      return `${step.from} → ${step.to}`;
    case "remover":
      return `Remover ${list(step.columns, "—")}`;
    case "tipo":
      return `${step.column} para ${step.to}`;
    case "ordenar":
      return `${step.column} (${step.dir === "asc" ? "crescente" : "decrescente"})`;
    case "remover_nulos":
      return `Nulos em ${list(step.columns, "—")}`;
    case "duplicadas":
      return `Duplicadas por ${list(step.columns)}`;
    case "preencher":
      return `${step.column}: nulo vira ${quoted(step.value)}`;
    case "agrupar": {
      const resumo = step.aggregations
        .map((aggregation) => `${AGG_LABELS[aggregation.fn].toLowerCase()}${aggregation.column ? ` de ${aggregation.column}` : ""}`)
        .join(", ");
      return `${step.by.length > 0 ? `Por ${list(step.by)}` : "Tudo"}: ${resumo || "sem resumo"}`;
    }
    case "mesclar":
      return `${step.query ? "outra consulta" : step.table} (${step.on.map((pair) => `${pair.left} = ${pair.right}`).join(", ")})`;
    case "dinamizar":
      return `${step.column} em colunas: ${AGG_LABELS[step.fn].toLowerCase()} de ${step.value}`;
    case "escolher":
      return `Manter ${list(step.columns, "—")}`;
    case "limitar":
      return `${step.mode === "manter" ? "Manter" : "Remover"} as primeiras ${step.n} linhas`;
    case "dividir":
      return `${step.column} por "${step.delimiter}" em ${step.parts} partes`;
    case "substituir":
      return `${step.column}: "${step.find}" → "${step.with}"`;
    case "condicional":
      return `${step.name}: se ${step.column} ${OP_LABELS[step.op]}${step.op === "nulo" || step.op === "nao_nulo" ? "" : ` ${quoted(step.value)}`}, ${quoted(step.then)}, senão ${quoted(step.otherwise)}`;
    case "indice":
      return `${step.name} (começa em ${step.start})`;
    case "calcular":
      return `${step.name} = ${step.left} ${step.op} ${"column" in step.right ? step.right.column : step.right.value}`;
    case "texto":
      return `${step.column}: ${{ maiusculas: "maiúsculas", minusculas: "minúsculas", aparar: "aparar espaços" }[step.fn]}`;
    case "data_parte":
      return `${step.name || step.column}: ${DATE_PART_LABELS[step.part].toLowerCase()}`;
    case "arredondar":
      return `${step.column} com ${step.digits} casa(s)`;
    case "filtrar_valores":
      return `${step.column} ${step.mode === "incluir" ? "é um de" : "não é"} ${list(step.values, "—")}`;
    case "acrescentar":
      return "Linhas de outra consulta no fim";
  }
};
