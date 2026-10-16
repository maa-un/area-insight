import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// maa'un のブランドの部品。note・Shorts の図解と同じ作法で、数字を形で見せる。

// 小見出し。左に短い赤銅の縦線＋字間を広げた小さな文字（Shorts のラベルを落ち着かせたもの）。
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-2.5 text-xs font-medium tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      <span className="inline-block h-4 w-px shrink-0 bg-terracotta" aria-hidden />
      {children}
    </p>
  );
}

// 横棒。背景はクリームの濃い色、通常はくすんだ色、強調はテラコッタ（図解バーと同じ配色）。
export function Bar({
  value,
  max,
  highlight = false,
  className,
}: {
  value: number | null;
  max: number;
  highlight?: boolean;
  className?: string;
}) {
  const width = value === null || max <= 0 ? 0 : Math.max(2, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-bar-bg", className)} aria-hidden>
      <div
        className={cn("h-full rounded-full", highlight ? "bg-terracotta" : "bg-bar-muted")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// 位置を示す目盛り。範囲（0〜100%）の中で、どこにあるかを点で示す。順位の表示に使う。
export function PositionBar({
  percent,
  className,
}: {
  // 0 = 左端（良い・安い）、100 = 右端
  percent: number;
  className?: string;
}) {
  const left = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-bar-bg", className)} aria-hidden>
      <div
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream bg-terracotta shadow-xs"
        style={{ left: `${left}%` }}
      />
    </div>
  );
}

// 判定のタグ。良い・ふつう・注意の 3 色。塗らずに細い線と文字色だけで示す。
export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: "good" | "neutral" | "bad";
  children: ReactNode;
}) {
  const tones = {
    good: "border-good/50 text-good",
    neutral: "border-border text-muted-foreground",
    bad: "border-bad/50 text-bad",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
