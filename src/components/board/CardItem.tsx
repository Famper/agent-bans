"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageSquare, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardDTO } from "@/types/board";

export function CardItem({
  card,
  accentColor,
  onOpen,
  isOverlay = false,
}: {
  card: CardDTO;
  accentColor: string;
  onOpen?: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: "card", columnId: card.columnId, sortOrder: card.sortOrder },
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: accentColor,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onOpen?.();
      }}
      className={cn(
        "group rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 shadow-sm cursor-grab active:cursor-grabbing border-l-4 transition-shadow hover:shadow-md",
        isDragging && "opacity-40",
        isOverlay && "shadow-xl ring-2 ring-[var(--color-ring)]"
      )}
    >
      <div className="text-sm font-medium leading-tight break-words">{card.title}</div>
      {card.body.trim() && (
        <div className="mt-1 text-xs text-[var(--color-muted-foreground)] line-clamp-2 break-words">
          {card.body.replace(/[#*_`>~\-]/g, "").trim()}
        </div>
      )}
      {(card.comments.length > 0 || card.attachments.length > 0) && (
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          {card.comments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {card.comments.length}
            </span>
          )}
          {card.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {card.attachments.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
