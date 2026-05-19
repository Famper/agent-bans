"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ColumnView } from "./ColumnView";
import { AddColumnForm } from "./AddColumnForm";
import { CardItem } from "./CardItem";
import { CardDialog } from "./CardDialog";
import { moveCard } from "@/app/actions/cards";
import { moveColumn as moveColumnAction } from "@/app/actions/columns";
import { signoutAction } from "@/app/actions/auth";
import { keyBetween } from "@/lib/ordering";
import type { BoardDTO, CardDTO, ColumnDTO } from "@/types/board";

type ActiveDrag =
  | { kind: "card"; card: CardDTO; columnColor: string }
  | { kind: "column"; column: ColumnDTO }
  | null;

export function BoardClient({
  initialBoard,
  userLabel,
}: {
  initialBoard: BoardDTO;
  userLabel: string;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardDTO>(initialBoard);
  const [active, setActive] = useState<ActiveDrag>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allCards: { card: CardDTO; columnColor: string }[] = board.columns.flatMap((col) =>
    col.cards.map((c) => ({ card: c, columnColor: col.color }))
  );

  function findCard(id: string): { columnIndex: number; cardIndex: number } | null {
    for (let ci = 0; ci < board.columns.length; ci++) {
      const idx = board.columns[ci].cards.findIndex((c) => c.id === id);
      if (idx >= 0) return { columnIndex: ci, cardIndex: idx };
    }
    return null;
  }

  function patchBoardColumn(columnId: string, patch: Partial<ColumnDTO>) {
    setBoard((b) => ({
      ...b,
      columns: b.columns.map((c) => (c.id === columnId ? { ...c, ...patch } : c)),
    }));
  }

  function patchCard(cardId: string, next: CardDTO) {
    setBoard((b) => ({
      ...b,
      columns: b.columns.map((col) => {
        const removed = col.cards.filter((c) => c.id !== cardId);
        if (col.id === next.columnId) {
          if (col.cards.some((c) => c.id === cardId)) {
            return { ...col, cards: col.cards.map((c) => (c.id === cardId ? next : c)) };
          }
          return { ...col, cards: [...removed, next] };
        }
        return { ...col, cards: removed };
      }),
    }));
  }

  function removeCard(cardId: string) {
    setBoard((b) => ({
      ...b,
      columns: b.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      })),
    }));
  }

  function removeColumn(columnId: string) {
    setBoard((b) => ({ ...b, columns: b.columns.filter((c) => c.id !== columnId) }));
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { type?: string; columnId?: string } | undefined;
    if (data?.type === "card") {
      const located = findCard(String(event.active.id));
      if (!located) return;
      const col = board.columns[located.columnIndex];
      const card = col.cards[located.cardIndex];
      setActive({ kind: "card", card, columnColor: col.color });
    } else if (data?.type === "column") {
      const col = board.columns.find((c) => c.id === event.active.id);
      if (col) setActive({ kind: "column", column: col });
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    setActive(null);
    if (!over) return;

    const activeData = a.data.current as { type?: string; columnId?: string } | undefined;
    const overData = over.data.current as
      | { type?: string; columnId?: string; sortOrder?: string }
      | undefined;

    if (activeData?.type === "column" && overData?.type === "column") {
      // Reorder columns
      const oldIdx = board.columns.findIndex((c) => c.id === a.id);
      const newIdx = board.columns.findIndex((c) => c.id === over.id);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;

      const reordered = [...board.columns];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      const before = reordered[newIdx - 1]?.sortOrder ?? null;
      const after = reordered[newIdx + 1]?.sortOrder ?? null;
      let newOrder: string;
      try {
        newOrder = keyBetween(before, after);
      } catch {
        return;
      }

      const patched = reordered.map((c, i) =>
        i === newIdx ? { ...c, sortOrder: newOrder } : c
      );
      setBoard((b) => ({ ...b, columns: patched }));

      startTransition(async () => {
        try {
          await moveColumnAction({ id: String(a.id), sortOrder: newOrder });
        } catch (e) {
          toast.error("Не удалось переместить колонку");
          router.refresh();
        }
      });
      return;
    }

    if (activeData?.type !== "card") return;

    const cardId = String(a.id);
    const located = findCard(cardId);
    if (!located) return;

    // Resolve target column
    let targetColumnId: string;
    let targetIndex: number;
    if (overData?.type === "column-drop") {
      targetColumnId = String(overData.columnId);
      const col = board.columns.find((c) => c.id === targetColumnId);
      targetIndex = col?.cards.length ?? 0;
    } else if (overData?.type === "card") {
      targetColumnId = String(overData.columnId);
      const col = board.columns.find((c) => c.id === targetColumnId);
      const overIdx = col?.cards.findIndex((c) => c.id === over.id) ?? 0;
      targetIndex = overIdx;
    } else {
      return;
    }

    // Build candidate column list with the card removed first
    const fromCol = board.columns[located.columnIndex];
    const card = fromCol.cards[located.cardIndex];

    const stripped = board.columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.id !== cardId),
    }));

    const targetCol = stripped.find((c) => c.id === targetColumnId);
    if (!targetCol) return;

    const insertAt = Math.min(targetIndex, targetCol.cards.length);
    const before = targetCol.cards[insertAt - 1]?.sortOrder ?? null;
    const after = targetCol.cards[insertAt]?.sortOrder ?? null;

    // Avoid no-op when dragging onto self position
    if (
      fromCol.id === targetColumnId &&
      board.columns.find((c) => c.id === targetColumnId)?.cards[insertAt]?.id === cardId
    ) {
      return;
    }

    let newSortOrder: string;
    try {
      newSortOrder = keyBetween(before, after);
    } catch {
      return;
    }

    const updatedCard: CardDTO = { ...card, columnId: targetColumnId, sortOrder: newSortOrder };
    const nextColumns = stripped.map((col) =>
      col.id === targetColumnId
        ? {
            ...col,
            cards: [...col.cards.slice(0, insertAt), updatedCard, ...col.cards.slice(insertAt)],
          }
        : col
    );
    setBoard((b) => ({ ...b, columns: nextColumns }));

    startTransition(async () => {
      try {
        await moveCard({ id: cardId, columnId: targetColumnId, sortOrder: newSortOrder });
      } catch (e) {
        toast.error("Не удалось переместить карточку");
        router.refresh();
      }
    });
  }

  const openCard =
    openCardId !== null
      ? allCards.find((x) => x.card.id === openCardId)?.card ?? null
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">{board.name}</h1>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {board.columns.length} колонок · {allCards.length} карточек
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-muted-foreground)]">{userLabel}</span>
          <form action={signoutAction}>
            <Button variant="outline" size="sm" type="submit">
              Выйти
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto px-4 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActive(null)}
        >
          <SortableContext
            items={board.columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 items-start min-h-0">
              {board.columns.map((col) => (
                <ColumnView
                  key={col.id}
                  column={col}
                  onCardOpen={(card) => setOpenCardId(card.id)}
                  onColumnLocalChange={(patch) => patchBoardColumn(col.id, patch)}
                  onColumnDeleted={() => removeColumn(col.id)}
                  onCardCreated={() => router.refresh()}
                />
              ))}
              <AddColumnForm boardId={board.id} onCreated={() => router.refresh()} />
            </div>
          </SortableContext>

          <DragOverlay>
            {active?.kind === "card" && (
              <div className="w-72">
                <CardItem card={active.card} accentColor={active.columnColor} isOverlay />
              </div>
            )}
            {active?.kind === "column" && (
              <div className="w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] opacity-80">
                <div
                  className="rounded-t-lg px-3 py-2 text-sm font-medium text-white"
                  style={{ background: active.column.color }}
                >
                  {active.column.name}
                </div>
                <div className="p-2 text-xs text-[var(--color-muted-foreground)]">
                  {active.column.cards.length} карточек
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {openCard && (
        <CardDialog
          card={openCard}
          columns={board.columns}
          open={!!openCardId}
          onOpenChange={(o) => !o && setOpenCardId(null)}
          onUpdated={(next) => patchCard(next.id, next)}
          onDeleted={() => {
            removeCard(openCard.id);
            setOpenCardId(null);
          }}
        />
      )}
    </div>
  );
}
