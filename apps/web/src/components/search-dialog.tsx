import { prefectureName } from "@area-insight/shared";
import {
  ArrowRight,
  BookOpen,
  Columns3,
  CornerDownLeft,
  Home,
  ListOrdered,
  Map as MapIcon,
  MapPin,
  Search,
} from "lucide-react";
import { type ComponentType, useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { dataset } from "@/data";
import { formatManYen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { areaPath } from "@/routes";

const OPEN_EVENT = "area-insight:open-search";

// どの画面からでも検索を開く。ボタンとキーボード（⌘K・Ctrl+K・/）の両方から呼ぶ。
export function openSearch() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Item = {
  key: string;
  href: string;
  label: string;
  sub?: string;
  value?: string;
  icon: ComponentType<{ className?: string }>;
};

const PAGES: Item[] = [
  { key: "home", href: "/", label: "ホーム", icon: Home },
  { key: "map", href: "/map/", label: "地図で探す", icon: MapIcon },
  { key: "rankings", href: "/rankings/", label: "ランキング", icon: ListOrdered },
  { key: "compare", href: "/compare/", label: "比較", icon: Columns3 },
  { key: "guide", href: "/guide/", label: "使い方", icon: BookOpen },
];

const MAX_RESULTS = 8;

function itemsOf(query: string): Item[] {
  const q = query.trim();
  if (!q) return PAGES;
  return dataset.areas
    .filter((a) => `${prefectureName(a.prefectureCode)}${a.name}`.includes(q))
    .slice(0, MAX_RESULTS)
    .map((a) => ({
      key: a.code,
      href: areaPath(a.code),
      label: a.name,
      sub: prefectureName(a.prefectureCode),
      value: formatManYen(a.tradePrice),
      icon: MapPin,
    }));
}

// コマンドパレット形式の市区町村検索。全件をブラウザに持っているので、入力のたびに絞り込む。
export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const items = itemsOf(query);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName));
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (item) window.location.href = item.href;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[12svh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">市区町村を検索</DialogTitle>
        <DialogDescription className="sr-only">
          市区町村名を入力すると、候補が表示されます。
        </DialogDescription>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            placeholder="市区町村名で検索（例: 松本市）"
            aria-label="市区町村名で検索"
            aria-controls={listId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, items.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(items[active]);
              }
            }}
          />
          <Kbd className="hidden sm:inline-flex">esc</Kbd>
        </div>
        <ul ref={list} id={listId} className="max-h-[50svh] overflow-y-auto p-2">
          <li className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
            {query.trim() ? "市区町村" : "ページ"}
          </li>
          {items.length === 0 && (
            <li className="px-2 py-8 text-center text-sm text-muted-foreground">
              「{query.trim()}」に一致する市区町村は見つかりませんでした
            </li>
          )}
          {items.map((item, i) => (
            <li
              key={item.key}
              data-index={i}
              className="stagger"
              style={{ "--i": i } as React.CSSProperties}
            >
              <a
                href={item.href}
                onMouseMove={() => setActive(i)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors",
                  i === active && "bg-accent text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md border bg-card text-muted-foreground transition-colors",
                    i === active && "border-primary/30 text-primary",
                  )}
                >
                  <item.icon className="size-4" aria-hidden />
                </span>
                <span className="flex-1 truncate font-medium">
                  {item.label}
                  {item.sub && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {item.sub}
                    </span>
                  )}
                </span>
                {item.value && (
                  <span className="text-xs text-muted-foreground tabular-nums">{item.value}</span>
                )}
                {i === active ? (
                  <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden />
                ) : (
                  <ArrowRight className="size-4 text-transparent" aria-hidden />
                )}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-4 border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            選ぶ
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            開く
          </span>
          <span className="ml-auto">
            全国 {dataset.areas.length.toLocaleString("ja-JP")} 市区町村
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
