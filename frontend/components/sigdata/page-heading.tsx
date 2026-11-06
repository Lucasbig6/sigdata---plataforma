import type { ReactNode } from "react";

/** Título da página, igual ao da home: título, uma linha de apoio e as ações à direita. */
export const PageHeading = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3 pb-8">
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);
