"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { useAdminStore, type AdminUser } from "@/lib/admin/store";

type DialogProps = { user: AdminUser | null; onClose: () => void };

/** Redefine a senha de outra conta (a pessoa troca depois, se quiser). */
export const PasswordDialog = ({ user, onClose }: DialogProps) => {
  const setPassword = useAdminStore((state) => state.setPassword);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setValue("");
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await setPassword(user.id, value);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Nova senha para {user?.name} ({user?.email}).
          </DialogDescription>
        </DialogHeader>
        <form id="redefinir-senha" onSubmit={submit} className="flex flex-col gap-1.5">
          <Input
            type="text"
            autoComplete="off"
            aria-label="Nova senha"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required
            minLength={8}
            maxLength={128}
            autoFocus
          />
          <span className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres.</span>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="redefinir-senha" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Salvar senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Remoção definitiva: some com a conta e com projetos, painéis e resultados dela. */
export const RemoveUserDialog = ({ user, onClose }: DialogProps) => {
  const removeUser = useAdminStore((state) => state.removeUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await removeUser(user.id);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover {user?.name}?</DialogTitle>
          <DialogDescription>
            A conta é excluída junto com os projetos, conversas e painéis dela. Fontes e datasets que a pessoa criou
            continuam no catálogo. Para só bloquear o acesso, use “Desativar”.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Remover conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
