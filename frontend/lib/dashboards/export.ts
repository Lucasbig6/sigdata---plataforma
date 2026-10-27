/**
 * Exportar a página como imagem (PNG) ou PDF. Roda no navegador a partir do
 * que está desenhado; as bibliotecas só carregam quando o usuário exporta.
 */
export type ExportFormat = "png" | "pdf";

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "painel";

const download = (href: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

/**
 * `node` é a página (.sd-canvas). Captura no tamanho lógico (sem o zoom da tela)
 * em alta resolução, para ficar nítido ao imprimir ou ampliar.
 */
export const exportPage = async (
  node: HTMLElement,
  options: { format: ExportFormat; name: string; width: number; height: number; background: string },
): Promise<void> => {
  const { toPng } = await import("html-to-image");
  const pixelRatio = Math.min(3, Math.max(1, 6000 / Math.max(options.width, options.height)));
  const dataUrl = await toPng(node, {
    width: options.width,
    height: options.height,
    pixelRatio,
    cacheBust: true,
    backgroundColor: options.background,
    // a tela mostra a página reduzida/ampliada por transform: aqui vale o tamanho real
    style: { transform: "none", transformOrigin: "top left", borderRadius: "0", boxShadow: "none", border: "0" },
  });

  const base = slug(options.name);
  if (options.format === "png") {
    download(dataUrl, `${base}.png`);
    return;
  }
  const { jsPDF } = await import("jspdf");
  const landscape = options.width >= options.height;
  const pdf = new jsPDF({
    orientation: landscape ? "landscape" : "portrait",
    unit: "px",
    format: [options.width, options.height],
    hotfixes: ["px_scaling"],
    compress: true,
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, options.width, options.height, undefined, "FAST");
  pdf.save(`${base}.pdf`);
};
