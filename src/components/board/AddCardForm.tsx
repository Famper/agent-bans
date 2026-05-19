"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCard } from "@/app/actions/cards";
import type { CardDTO } from "@/types/board";

export function AddCardForm({
  columnId,
  onCreated,
}: {
  columnId: string;
  onCreated: (card: CardDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t) return;
    startTransition(async () => {
      try {
        const created = await createCard({ columnId, title: t });
        onCreated(created);
        setTitle("");
        setOpen(false);
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось создать карточку");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--color-muted-foreground)] hover:bg-black/10"
      >
        <Plus className="h-3.5 w-3.5" /> Карточка
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-2">
      <Input
        autoFocus
        placeholder="Заголовок"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Отмена
        </Button>
        <Button size="sm" onClick={submit} disabled={pending || !title.trim()}>
          {pending ? "…" : "Добавить"}
        </Button>
      </div>
    </div>
  );
}
