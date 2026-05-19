"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "./ColorPicker";
import { updateColumn, deleteColumn } from "@/app/actions/columns";
import type { ColumnDTO } from "@/types/board";

export function ColumnSettings({
  column,
  onLocalChange,
  onDeleted,
}: {
  column: ColumnDTO;
  onLocalChange: (next: Partial<ColumnDTO>) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [pending, startTransition] = useTransition();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await updateColumn({ id: column.id, name: trimmed, color });
        onLocalChange({ name: trimmed, color });
        toast.success("Сохранено");
        setOpen(false);
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось сохранить");
      }
    });
  }

  function remove() {
    if (!confirm(`Удалить колонку «${column.name}» вместе с карточками?`)) return;
    startTransition(async () => {
      try {
        await deleteColumn(column.id);
        onDeleted();
        toast.success("Колонка удалена");
        setOpen(false);
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось удалить");
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="rounded p-1 text-[var(--color-card-foreground)]/70 hover:bg-black/20"
          aria-label="Настройки колонки"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`col-name-${column.id}`}>Название</Label>
          <Input
            id={`col-name-${column.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label>Цвет</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-between pt-1">
          <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
            <Trash2 className="h-4 w-4 mr-1" /> Удалить
          </Button>
          <Button size="sm" onClick={save} disabled={pending || !name.trim()}>
            Сохранить
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
