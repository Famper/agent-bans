"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
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
  | { kind: "card"; card: CardDTO; columnColor: string; originColumnId: string }
  | { kind: "column"; column: ColumnDTO }
  | null;

interface DragData {
  type?: "card" | "column" | "column-drop";
  columnId?: string;
  sortOrder?: string;
}

function getData(node: { data: { current: unknown } } | null | undefined): DragData {
  return (node?.data.current ?? {}) as DragData;
}

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

  // Re-sync local state when the server snapshot changes (after router.refresh()).
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Prefer pointer-within for column drop targets, fall back to rect intersection for cards.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    return rectIntersection(args);
  }, []);

  const allCards: { card: CardDTO; columnColor: string }[] = useMemo(
    () =>
      board.columns.flatMap((col) =>
        col.cards.map((c) => ({ card: c, columnColor: col.color }))
      ),
    [board]
  );

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

  function appendColumn(col: ColumnDTO) {
    setBoard((b) => ({ ...b, columns: [...b.columns, col] }));
  }

  function appendCard(card: CardDTO) {
    setBoard((b) => ({
      ...b,
      columns: b.columns.map((col) =>
        col.id === card.columnId ? { ...col, cards: [...col.cards, card] } : col
      ),
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

  function findCard(id: string): { columnIndex: number; cardIndex: number } | null {
    for (let ci = 0; ci < board.columns.length; ci++) {
      const idx = board.columns[ci].cards.findIndex((c) => c.id === id);
      if (idx >= 0) return { columnIndex: ci, cardIndex: idx };
    }
    return null;
  }

  function onDragStart(event: DragStartEvent) {
    const data = getData(event.active);
    if (data.type === "card") {
      const located = findCard(String(event.active.id));
      if (!located) return;
      const col = board.columns[located.columnIndex];
      const card = col.cards[located.cardIndex];
      setActive({ kind: "card", card, columnColor: col.color, originColumnId: col.id });
    } else if (data.type === "column") {
      const col = board.columns.find((c) => c.id === event.active.id);
      if (col) setActive({ kind: "column", column: col });
    }
  }

  // Shift card across columns during the drag for live visual feedback.
  function onDragOver(event: DragOverEvent) {
    const { active: a, over } = event;
    if (!over) return;
    const activeData = getData(a);
    if (activeData.type !== "card") return;

    const overData = getData(over);
    const targetColumnId =
      overData.type === "column-drop" || overData.type === "card"
        ? overData.columnId
        : undefined;
    if (!targetColumnId) return;

    const cardId = String(a.id);
    setBoard((b) => {
      const fromCol = b.columns.find((c) => c.cards.some((card) => card.id === cardId));
      const toCol = b.columns.find((c) => c.id === targetColumnId);
      if (!fromCol || !toCol) return b;
      if (fromCol.id === toCol.id) return b; // within-column handled by SortableContext

      const card = fromCol.cards.find((c) => c.id === cardId);
      if (!card) return b;

      // Compute insertion index in target column based on what we're hovering.
      let insertAt = toCol.cards.length;
      if (overData.type === "card") {
        const overIdx = toCol.cards.findIndex((c) => c.id === over.id);
        if (overIdx >= 0) insertAt = overIdx;
      }

      const moved: CardDTO = { ...card, columnId: toCol.id };
      return {
        ...b,
        columns: b.columns.map((col) => {
          if (col.id === fromCol.id) {
            return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
          }
          if (col.id === toCol.id) {
            return {
              ...col,
              cards: [...col.cards.slice(0, insertAt), moved, ...col.cards.slice(insertAt)],
            };
          }
          return col;
        }),
      };
    });
  }

  async function onDragEnd(event: DragEndEvent) {
    const dropped = active;
    const { active: a, over } = event;
    setActive(null);
    if (!over) {
      // Cancelled — re-sync from server if cross-column drag was in progress.
      if (dropped?.kind === "card") router.refresh();
      return;
    }

    const activeData = getData(a);
    const overData = getData(over);

    // Column reorder
    if (activeData.type === "column" && overData.type === "column") {
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
        } catch {
          toast.error("Не удалось переместить колонку");
          router.refresh();
        }
      });
      return;
    }

    if (activeData.type !== "card") return;

    const cardId = String(a.id);
    if (over.id === a.id) return; // dropped on self

    // Locate the card in the *current* (post-onDragOver) state. For cross-column
    // drags this is already in the target column; for within-column drags this
    // is still the original position because onDragOver intentionally skips
    // same-column shuffling (the SortableContext renders the visual offset).
    const here = findCard(cardId);
    if (!here) return;
    const currentCol = board.columns[here.columnIndex];
    const currentIdx = here.cardIndex;

    // Resolve target column id based on what we dropped on.
    let targetColumnId = currentCol.id;
    if (overData.type === "column-drop") {
      targetColumnId = String(overData.columnId);
    } else if (overData.type === "card") {
      const overCol = board.columns.find((c) => c.cards.some((cc) => cc.id === over.id));
      if (overCol) targetColumnId = overCol.id;
    }

    let nextCardsInTarget: CardDTO[];
    let nextIndex: number;

    if (targetColumnId === currentCol.id) {
      // === Same-column move: apply arrayMove based on over.id ===
      if (overData.type === "card" && over.id !== a.id) {
        const overIdx = currentCol.cards.findIndex((c) => c.id === over.id);
        if (overIdx < 0 || overIdx === currentIdx) return;
        nextCardsInTarget = arrayMove(currentCol.cards, currentIdx, overIdx);
        nextIndex = overIdx;
      } else if (overData.type === "column-drop") {
        const lastIdx = currentCol.cards.length - 1;
        if (currentIdx === lastIdx) return;
        nextCardsInTarget = arrayMove(currentCol.cards, currentIdx, lastIdx);
        nextIndex = lastIdx;
      } else {
        return;
      }
    } else {
      // === Cross-column move: onDragOver already placed the card in the target column. ===
      const targetCol = board.columns.find((c) => c.id === targetColumnId);
      if (!targetCol) return;
      const idx = targetCol.cards.findIndex((c) => c.id === cardId);
      if (idx < 0) return;
      nextCardsInTarget = targetCol.cards;
      nextIndex = idx;
    }

    // Compute sortOrder from the card's NEW neighbors in nextCardsInTarget.
    const beforeOrder = nextIndex > 0 ? nextCardsInTarget[nextIndex - 1].sortOrder : null;
    const afterOrder =
      nextIndex < nextCardsInTarget.length - 1
        ? nextCardsInTarget[nextIndex + 1].sortOrder
        : null;

    let newSortOrder: string;
    try {
      newSortOrder = keyBetween(beforeOrder, afterOrder);
    } catch {
      return;
    }

    setBoard((b) => ({
      ...b,
      columns: b.columns.map((c) => {
        // Strip card from any non-target column (cross-column case).
        if (c.id !== targetColumnId) {
          return { ...c, cards: c.cards.filter((cc) => cc.id !== cardId) };
        }
        return {
          ...c,
          cards: nextCardsInTarget.map((cc) =>
            cc.id === cardId
              ? { ...cc, sortOrder: newSortOrder, columnId: targetColumnId }
              : cc
          ),
        };
      }),
    }));

    startTransition(async () => {
      try {
        await moveCard({ id: cardId, columnId: targetColumnId, sortOrder: newSortOrder });
      } catch {
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
          id="kanban-dnd"
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
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
                  onCardCreated={appendCard}
                />
              ))}
              <AddColumnForm boardId={board.id} onCreated={appendColumn} />
            </div>
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
            {active?.kind === "card" && (
              <div className="w-72 rotate-1">
                <CardItem card={active.card} accentColor={active.columnColor} isOverlay />
              </div>
            )}
            {active?.kind === "column" && (
              <div className="w-72 rounded-lg border-2 border-[var(--color-ring)] bg-[var(--color-card)] opacity-90 shadow-2xl">
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
