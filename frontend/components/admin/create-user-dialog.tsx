"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { DEFAULT_ROLE, ROLE_DESCRIPTIONS, type Role } from "@shared/domain/roles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAdminStore } from "@/lib/admin/store";
import { RoleSelect } from "./role-select";

/** Nova conta: o admin define papel e senha inicial e repassa à pessoa. */
export const CreateUserDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const createUser = useAdminStore((state) => state.createUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole(DEFAULT_ROLE);
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createUser({ name, email, password, role });
      reset();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Envie o e-mail e a senha inicial para a pessoa. Ela entra direto, sem confirmação.
          </DialogDescription>
        </DialogHeader>
        <form id="novo-usuario" onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Nome</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoFocus />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">E-mail</span>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Senha inicial</span>
            <Input
              type="text"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              maxLength={128}
            />
            <span className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Perfil</span>
            <RoleSelect value={role} onChange={setRole} className="h-9 text-sm" />
            <span className="text-[11px] text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
          </label>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="novo-usuario" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
