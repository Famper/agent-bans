"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

export interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  onImagePaste?: (file: File) => Promise<string | null>;
  height?: number;
  placeholder?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  onImagePaste,
  height = 280,
  placeholder = "Поддерживается markdown: **жирный**, заголовки, списки, код, ссылки, картинки…",
}: MarkdownEditorProps) {
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!onImagePaste) return;
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((it) => it.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      const url = await onImagePaste(file);
      if (url) onChange(`${value}${value.endsWith("\n") || value === "" ? "" : "\n"}![image](${url})\n`);
    },
    [onImagePaste, onChange, value]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      if (!onImagePaste) return;
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length === 0) return;
      e.preventDefault();
      for (const file of files) {
        const url = await onImagePaste(file);
        if (url) {
          onChange(`${value}${value.endsWith("\n") || value === "" ? "" : "\n"}![${file.name}](${url})\n`);
        }
      }
    },
    [onImagePaste, onChange, value]
  );

  return (
    <div data-color-mode="dark" onPaste={handlePaste} onDrop={handleDrop}>
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        preview="edit"
        textareaProps={{ placeholder }}
      />
    </div>
  );
}
