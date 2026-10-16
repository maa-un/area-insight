import { type ComponentType, type ReactNode, useEffect, useRef } from "react";
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
        className={cn(
          "h-full origin-left animate-grow-x rounded-full",
          highlight ? "bg-terracotta" : "bg-bar-muted",
        )}
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
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-terracotta shadow-xs"
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

// ページの見出し。アイコン付きの小見出し・タイトル・説明と、右側の操作をまとめる。
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  icon?: ComponentType<{ className?: string }>;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 animate-rise sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-2">
        {(Icon || eyebrow) && (
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {Icon && (
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-3.5" />
              </span>
            )}
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl text-balance sm:text-3xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

// 数字を 0 から数え上げて見せる。サーバーで書き出した最終の文字列をそのまま使い、
// 表示後に先頭の数値だけを書き換える（ハイドレーションの不一致を起こさない）。
export function CountUp({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    const match = /-?[\d,]+(\.\d+)?/.exec(text);
    if (!node || !match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = Number(match[0].replaceAll(",", ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = match[1] ? match[1].length - 1 : 0;
    const comma = match[0].includes(",");
    const format = (v: number) =>
      comma
        ? v.toLocaleString("ja-JP", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : v.toFixed(decimals);
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);
    const duration = 900;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 4;
      node.textContent = `${before}${format(target * eased)}${after}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.textContent = text;
    };
  }, [text]);
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
