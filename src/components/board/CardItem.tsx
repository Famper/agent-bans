"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquare, Paperclip } from "lucide-react";
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
      className={cn(
        "group relative rounded-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm border-l-4 transition-all",
        "hover:border-[var(--color-ring)]/40 hover:shadow-lg hover:-translate-y-px",
        isDragging && !isOverlay && "opacity-30",
        isOverlay && "shadow-2xl ring-2 ring-[var(--color-ring)] cursor-grabbing"
      )}
    >
      {/* Drag handle — covers most of the card, leaves room for click-to-open */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-0 top-0 flex h-7 w-full items-start justify-start gap-1 px-2 pt-1.5 text-[var(--color-muted-foreground)]/40 cursor-grab active:cursor-grabbing",
          "hover:text-[var(--color-muted-foreground)]/80"
        )}
        aria-label="Перетащить карточку"
      >
        <GripVertical className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
          переместить
        </span>
      </button>

      <div
        onClick={() => onOpen?.()}
        className="cursor-pointer pt-7 px-2.5 pb-2.5"
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
    </div>
  );
}
