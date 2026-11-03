import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

type Crumb = { label: string; href?: string };

/** Trilha de navegação: os itens com `href` são links; o último é a página atual (o título da tela). */
export const Breadcrumbs = ({ items }: { items: Crumb[] }) => (
  <nav aria-label="Você está em" className="min-w-0">
    <ol className="flex min-w-0 items-center gap-1 text-base">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <Fragment key={item.label}>
            {index > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden /> : null}
            <li className="min-w-0">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded text-sm whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              ) : (
                <h1 aria-current="page" className="truncate font-semibold text-foreground">
                  {item.label}
                </h1>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  </nav>
);
