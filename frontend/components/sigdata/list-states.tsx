import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Estados padrão das listas: carregando, vazio e erro com nova tentativa. */

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
    {Icon ? (
      <span className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
    ) : null}
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description ? (
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
    ) : null}
    {action}
  </div>
);

export const ErrorState = ({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/40 px-6 py-16 text-center"
  >
    <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
      <AlertTriangle className="size-5" aria-hidden />
    </span>
    <p className="text-sm font-medium text-foreground">{title}</p>
    <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{message}</p>
    {onRetry ? (
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    ) : null}
  </div>
);

/** Esqueleto de grade de cartões; `list` troca por linhas empilhadas. */
export const CardSkeletons = ({
  count = 4,
  className,
  itemClassName,
}: {
  count?: number;
  className?: string;
  itemClassName?: string;
}) => (
  <div role="status" aria-label="Carregando" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className={cn("h-32 rounded-2xl bg-muted/50", itemClassName)} />
    ))}
  </div>
);

/** Linhas curtas para listas estreitas (barra lateral). */
export const LineSkeletons = ({ count = 3 }: { count?: number }) => (
  <div role="status" aria-label="Carregando" className="flex flex-col gap-1.5">
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} className="h-8 w-full" />
    ))}
  </div>
);
