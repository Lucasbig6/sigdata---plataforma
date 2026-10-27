/**
 * Páginas de um dashboard. Em tempo de edição o documento guarda a página ativa
 * no topo (`canvas`/`elements`, que o resto do editor já usa) e a lista completa
 * em `pages`; as funções daqui mantêm os dois lados em sincronia.
 */
import {
  MAX_PAGES,
  uid,
  type Dashboard,
  type DashboardElement,
  type DashboardPage,
} from "@/lib/dashboards/types";

export const firstPageId = (doc: Dashboard | undefined | null): string | null => doc?.pages?.[0]?.id ?? null;

/** Escreve a página ativa (topo do documento) de volta na lista de páginas. */
export const syncActive = (doc: Dashboard, activeId: string | null): Dashboard => {
  if (!doc.pages) return doc;
  const id = activeId ?? doc.pages[0]?.id;
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === id ? { ...page, canvas: doc.canvas, elements: doc.elements } : page,
    ),
  };
};

/** Formato gravado: o topo espelha a primeira página. */
export const toPersisted = (doc: Dashboard, activeId: string | null): Dashboard => {
  const synced = syncActive(doc, activeId);
  if (!synced.pages) return synced;
  const first = synced.pages[0];
  return { ...synced, canvas: first.canvas, elements: first.elements };
};

const withActive = (doc: Dashboard, page: DashboardPage): Dashboard => ({
  ...doc,
  canvas: page.canvas,
  elements: page.elements,
});

export const goToPage = (doc: Dashboard, activeId: string | null, targetId: string): Dashboard | null => {
  const synced = syncActive(doc, activeId);
  const target = synced.pages?.find((page) => page.id === targetId);
  return target ? withActive(synced, target) : null;
};

export const pageName = (index: number) => `Página ${index + 1}`;

/** Acrescenta uma página vazia (criando a lista na primeira vez) e torna-a ativa. */
export const appendPage = (
  doc: Dashboard,
  activeId: string | null,
): { doc: Dashboard; activeId: string } | null => {
  const synced = syncActive(doc, activeId);
  const existing: DashboardPage[] = synced.pages ?? [
    { id: uid("pg"), name: pageName(0), canvas: synced.canvas, elements: synced.elements },
  ];
  if (existing.length >= MAX_PAGES) return null;
  const base = existing.find((page) => page.id === (activeId ?? existing[0].id)) ?? existing[0];
  const page: DashboardPage = {
    id: uid("pg"),
    name: pageName(existing.length),
    canvas: { ...base.canvas },
    elements: [],
  };
  return { doc: withActive({ ...synced, pages: [...existing, page] }, page), activeId: page.id };
};

const renew = (elements: DashboardElement[]): DashboardElement[] => {
  const groups = new Map<string, string>();
  return elements.map((el) => {
    const groupId = el.groupId ? (groups.get(el.groupId) ?? uid("grp")) : undefined;
    if (el.groupId && groupId) groups.set(el.groupId, groupId);
    const { groupId: _old, ...rest } = el;
    return { ...rest, id: uid(el.type), ...(groupId && { groupId }) } as DashboardElement;
  });
};

export const duplicatePage = (
  doc: Dashboard,
  activeId: string | null,
  pageId: string,
): { doc: Dashboard; activeId: string } | null => {
  const synced = syncActive(doc, activeId);
  const pages = synced.pages;
  const source = pages?.find((page) => page.id === pageId);
  if (!pages || !source || pages.length >= MAX_PAGES) return null;
  const copy: DashboardPage = {
    id: uid("pg"),
    name: `${source.name} (cópia)`.slice(0, 60),
    canvas: { ...source.canvas },
    elements: renew(JSON.parse(JSON.stringify(source.elements)) as DashboardElement[]),
  };
  const index = pages.findIndex((page) => page.id === pageId);
  const next = [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
  return { doc: withActive({ ...synced, pages: next }, copy), activeId: copy.id };
};

/** Remove uma página; com uma só restante, o painel volta ao formato de página única. */
export const removePage = (
  doc: Dashboard,
  activeId: string | null,
  pageId: string,
): { doc: Dashboard; activeId: string | null } | null => {
  const synced = syncActive(doc, activeId);
  const pages = synced.pages;
  if (!pages || pages.length < 2) return null;
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) return null;
  const remaining = pages.filter((page) => page.id !== pageId);
  const wasActive = (activeId ?? pages[0].id) === pageId;
  const nextActive = wasActive ? remaining[Math.min(index, remaining.length - 1)] : remaining.find((p) => p.id === activeId)!;
  if (remaining.length === 1) {
    const { pages: _gone, ...single } = synced;
    return { doc: withActive(single, remaining[0]), activeId: null };
  }
  return { doc: withActive({ ...synced, pages: remaining }, nextActive), activeId: nextActive.id };
};

export const renamePage = (doc: Dashboard, pageId: string, name: string): Dashboard => ({
  ...doc,
  pages: doc.pages?.map((page) => (page.id === pageId ? { ...page, name: name.slice(0, 60) } : page)),
});

export const movePage = (doc: Dashboard, activeId: string | null, pageId: string, direction: -1 | 1): Dashboard => {
  const synced = syncActive(doc, activeId);
  const pages = synced.pages;
  if (!pages) return doc;
  const index = pages.findIndex((page) => page.id === pageId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= pages.length) return doc;
  const next = [...pages];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...synced, pages: next };
};

/** Filtros globais de outras páginas: continuam valendo na página aberta. */
export const globalFiltersFromOtherPages = (doc: Dashboard, activeId: string | null): DashboardElement[] =>
  (doc.pages ?? [])
    .filter((page) => page.id !== (activeId ?? doc.pages?.[0]?.id))
    .flatMap((page) =>
      page.elements.filter((el) => el.type === "filter" && (el.props as { global?: boolean }).global === true),
    );
