/** URLs da aplicação em um só lugar, para não espalhar strings de rota. */
export const projectHref = (id: string, chatId?: string): string =>
  chatId ? `/projetos/${id}?c=${chatId}` : `/projetos/${id}`;
