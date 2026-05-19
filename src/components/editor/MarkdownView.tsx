"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  if (!source.trim()) {
    return (
      <p className={cn("text-sm text-[var(--color-muted-foreground)] italic", className)}>
        Описание пустое.
      </p>
    );
  }
  return (
    <div className={cn("md-body text-sm", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
