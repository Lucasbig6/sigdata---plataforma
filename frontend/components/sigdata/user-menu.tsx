"use client";

import { LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@shared/domain/roles";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useRole, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

/** Iniciais do nome (primeiro + último), com o e-mail como reserva. */
const initialsOf = (name: string | undefined, email: string | undefined) => {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "";
};

export const UserAvatar = ({
  name,
  email,
  image,
  size = "default",
}: {
  name?: string;
  email?: string;
  image?: string | null;
  size?: "sm" | "default" | "lg";
}) => {
  const initials = initialsOf(name, email);

  return (
    <Avatar size={size}>
      {image && <AvatarImage src={image} alt="" />}
      <AvatarFallback
        className={cn(
          "bg-primary/15 font-medium text-primary",
          size === "lg" ? "text-sm" : size === "sm" ? "text-[10px]" : "text-xs",
        )}
      >
        {initials || <UserRound className="size-4" aria-hidden />}
      </AvatarFallback>
    </Avatar>
  );
};

/** Menu do usuário (avatar + nome/e-mail + sair) usado nos headers de todo o sistema. */
export const UserMenu = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const role = useRole();

  const handleSignOut = () => {
    void signOut().then(() => {
      window.location.assign("/login");
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menu do usuário"
        title={user?.name ? `Conectado como ${user.name}` : "Conta"}
        className="shrink-0 rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-ring/60 data-[popup-open]:ring-2 data-[popup-open]:ring-primary/50"
      >
        <UserAvatar name={user?.name} email={user?.email} image={user?.image} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar name={user?.name} email={user?.email} image={user?.image} size="lg" />
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {user?.name ?? "Você"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user?.email ?? "carregando sessão…"}
            </span>
            {role ? (
              <span className="mt-1 inline-flex rounded-full border border-border bg-muted/50 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        {role === "admin" ? (
          <>
            <DropdownMenuItem onClick={() => router.push("/admin")}>
              <ShieldCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              Administração
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
