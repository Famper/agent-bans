"use client";

import { cn } from "@/lib/utils";

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#94a3b8",
  "#475569",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
              value.toLowerCase() === c.toLowerCase()
                ? "border-white"
                : "border-transparent"
            )}
            style={{ background: c }}
            aria-label={`Цвет ${c}`}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
        Свой:
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-12 cursor-pointer rounded bg-transparent"
        />
        <span className="font-mono">{value.toUpperCase()}</span>
      </label>
    </div>
  );
}
