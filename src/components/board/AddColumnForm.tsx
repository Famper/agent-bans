"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "./ColorPicker";
import { createColumn } from "@/app/actions/columns";
import type { ColumnDTO } from "@/types/board";

export function AddColumnForm({
  boardId,
  onCreated,
}: {
  boardId: string;
  onCreated: (column: ColumnDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const created = await createColumn({ boardId, name: trimmed, color });
        onCreated(created);
        toast.success("Колонка создана");
        setName("");
        setColor("#3b82f6");
        setOpen(false);
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось создать колонку");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex h-12 w-72 shrink-0 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        <Plus className="h-4 w-4" />
        Добавить колонку
      </button>
    );
  }

  return (
    <div className="w-72 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 space-y-3">
      <Input
        autoFocus
        placeholder="Название колонки"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <ColorPicker value={color} onChange={setColor} />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          Отмена
        </Button>
        <Button size="sm" onClick={submit} disabled={pending || !name.trim()}>
          {pending ? "Создаём…" : "Создать"}
        </Button>
      </div>
    </div>
  );
}
