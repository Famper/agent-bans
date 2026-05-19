"use client";

import { useState, useTransition } from "react";
import { Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { MarkdownView } from "@/components/editor/MarkdownView";
import { ColorSwatch } from "./ColorSwatch";
import { updateCard, deleteCard, moveCard } from "@/app/actions/cards";
import { addComment, deleteComment } from "@/app/actions/comments";
import { uploadAttachment, deleteAttachment } from "@/app/actions/attachments";
import { keyBetween } from "@/lib/ordering";
import type { CardDTO, ColumnDTO } from "@/types/board";

export function CardDialog({
  card,
  columns,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  card: CardDTO;
  columns: ColumnDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (next: CardDTO) => void;
  onDeleted: () => void;
}) {
  const currentColumn = columns.find((c) => c.id === card.columnId);
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [commentText, setCommentText] = useState("");
  const [pending, startTransition] = useTransition();

  const dirty = title.trim() !== card.title || body !== card.body;

  function saveContent() {
    if (!dirty) return;
    const t = title.trim();
    if (!t) {
      toast.error("Заголовок не может быть пустым");
      return;
    }
    startTransition(async () => {
      try {
        await updateCard({ id: card.id, title: t, body });
        onUpdated({ ...card, title: t, body, updatedAt: new Date().toISOString() });
        toast.success("Сохранено");
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось сохранить");
      }
    });
  }

  function changeStatus(newColumnId: string) {
    if (newColumnId === card.columnId) return;
    const targetCol = columns.find((c) => c.id === newColumnId);
    if (!targetCol) return;
    const last = targetCol.cards[targetCol.cards.length - 1];
    const sortOrder = keyBetween(last?.sortOrder ?? null, null);
    startTransition(async () => {
      try {
        await moveCard({ id: card.id, columnId: newColumnId, sortOrder });
        onUpdated({ ...card, columnId: newColumnId, sortOrder });
        toast.success("Статус обновлён");
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось изменить статус");
      }
    });
  }

  function remove() {
    if (!confirm("Удалить карточку?")) return;
    startTransition(async () => {
      try {
        await deleteCard(card.id);
        onDeleted();
        onOpenChange(false);
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось удалить");
      }
    });
  }

  function postComment() {
    const t = commentText.trim();
    if (!t) return;
    startTransition(async () => {
      try {
        const created = await addComment({ cardId: card.id, text: t });
        onUpdated({
          ...card,
          comments: [
            ...card.comments,
            {
              id: created.id,
              cardId: created.cardId,
              text: created.text,
              authorName: created.authorName,
              authorId: created.authorId,
              createdAt: created.createdAt.toISOString(),
            },
          ],
        });
        setCommentText("");
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось добавить комментарий");
      }
    });
  }

  function removeComment(id: string) {
    startTransition(async () => {
      try {
        await deleteComment(id);
        onUpdated({ ...card, comments: card.comments.filter((c) => c.id !== id) });
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось удалить");
      }
    });
  }

  async function uploadFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.set("cardId", card.id);
    fd.set("file", file);
    const res = await uploadAttachment(fd);
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    onUpdated({ ...card, attachments: [...card.attachments, res.attachment] });
    return res.attachment.url;
  }

  async function onAttachClick(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    await uploadFile(file);
    input.value = "";
  }

  function removeAttachment(id: string) {
    startTransition(async () => {
      try {
        await deleteAttachment(id);
        onUpdated({ ...card, attachments: card.attachments.filter((a) => a.id !== id) });
      } catch (e) {
        toast.error((e as Error).message ?? "Не удалось удалить");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">Карточка</DialogTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-semibold h-10"
            placeholder="Заголовок карточки"
          />
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Описание (markdown)</Label>
              <MarkdownEditor
                value={body}
                onChange={setBody}
                onImagePaste={uploadFile}
                height={260}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Превью</Label>
              </div>
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-input)]/40 p-3">
                <MarkdownView source={body} />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="destructive" size="sm" onClick={remove} disabled={pending}>
                <Trash2 className="h-4 w-4 mr-1" /> Удалить карточку
              </Button>
              <Button size="sm" onClick={saveContent} disabled={!dirty || pending}>
                {pending ? "…" : "Сохранить"}
              </Button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select value={card.columnId} onValueChange={changeStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Колонка">
                    {currentColumn && (
                      <span className="inline-flex items-center gap-2">
                        <ColorSwatch color={currentColumn.color} />
                        {currentColumn.name}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <ColorSwatch color={c.color} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Картинки</Label>
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]">
                <Paperclip className="h-4 w-4" />
                Прикрепить
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onAttachClick(e.currentTarget)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                {card.attachments.map((a) => (
                  <div key={a.id} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.filename}
                      className="h-24 w-full rounded-md object-cover border border-[var(--color-border)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white group-hover:flex"
                      aria-label="Удалить"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {card.attachments.length === 0 && (
                  <p className="col-span-2 text-xs text-[var(--color-muted-foreground)]">
                    Нет картинок.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="pt-3 border-t border-[var(--color-border)] space-y-3">
          <Label>Комментарии</Label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {card.comments.length === 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">Пока нет комментариев.</p>
            )}
            {card.comments.map((c) => (
              <div
                key={c.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-input)]/40 p-2 group"
              >
                <div className="flex items-center justify-between text-xs text-[var(--color-muted-foreground)] mb-1">
                  <span>
                    <strong>{c.authorName ?? "Аноним"}</strong>{" "}
                    · {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => removeComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Удалить"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <MarkdownView source={c.text} className="text-sm" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <MarkdownEditor
              value={commentText}
              onChange={setCommentText}
              onImagePaste={uploadFile}
              height={120}
              placeholder="Комментарий (markdown поддерживается)…"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={postComment} disabled={pending || !commentText.trim()}>
                Отправить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
