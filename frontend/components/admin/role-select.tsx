"use client";

import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@shared/domain/roles";
import { cn } from "@/lib/utils";

/** Seletor de papel (nativo: acessível e leve dentro de tabelas e diálogos). */
export const RoleSelect = ({
  value,
  onChange,
  disabled,
  className,
  ...props
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  id?: string;
}) => (
  <select
    {...props}
    value={value}
    disabled={disabled}
    title={ROLE_DESCRIPTIONS[value]}
    onChange={(event) => onChange(event.target.value as Role)}
    className={cn(
      "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
  >
    {[...ROLES].reverse().map((role) => (
      <option key={role} value={role}>
        {ROLE_LABELS[role]}
      </option>
    ))}
  </select>
);
