"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { CardItem } from "./CardItem";
import { AddCardForm } from "./AddCardForm";
import { ColumnSettings } from "./ColumnSettings";
import type { CardDTO, ColumnDTO } from "@/types/board";

export function ColumnView({
  column,
  onCardOpen,
  onColumnLocalChange,
  onColumnDeleted,
  onCardCreated,
}: {
  column: ColumnDTO;
  onCardOpen: (card: CardDTO) => void;
  onColumnLocalChange: (patch: Partial<ColumnDTO>) => void;
  onColumnDeleted: () => void;
  onCardCreated: (card: CardDTO) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: "column", sortOrder: column.sortOrder },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: "column-drop", columnId: column.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={cn(
        "w-72 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]/60 backdrop-blur flex flex-col max-h-[calc(100vh-9rem)]",
        isDragging && "opacity-50"
      )}
    >
      <header
        className="flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium"
        style={{ background: column.color }}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-white/70 hover:text-white"
          aria-label="Перетащить колонку"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-white drop-shadow flex-1 truncate">{column.name}</span>
        <span className="text-xs text-white/70 tabular-nums">{column.cards.length}</span>
        <ColumnSettings
          column={column}
          onLocalChange={onColumnLocalChange}
          onDeleted={onColumnDeleted}
        />
      </header>

      <div
        ref={setDroppableRef}
        className={cn(
          "flex-1 overflow-y-auto p-2 space-y-2 transition-colors",
          isOver && "bg-[var(--color-muted)]/30"
        )}
      >
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              accentColor={column.color}
              onOpen={() => onCardOpen(card)}
            />
          ))}
        </SortableContext>
        {column.cards.length === 0 && (
          <div className="text-xs text-[var(--color-muted-foreground)] text-center py-4">
            Перетащите карточку или создайте новую
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[var(--color-border)]">
        <AddCardForm columnId={column.id} onCreated={onCardCreated} />
      </div>
    </div>
  );
}
