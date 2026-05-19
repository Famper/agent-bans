"use client";

import { cn } from "@/lib/utils";

export function ColorSwatch({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <span
      className={cn("inline-block rounded-full border border-black/30")}
      style={{ background: color, width: size, height: size }}
    />
  );
}
