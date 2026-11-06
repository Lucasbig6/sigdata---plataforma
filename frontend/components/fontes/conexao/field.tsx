"use client";

export const Field = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
      {title}
    </label>
    {children}
  </div>
);
