import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageCount, pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

// 一覧の下に置くページ送り。「1〜50 件 / 1,741 件」と前後・番号のボタンを出す。
// 狭い画面では番号を省き、前後のボタンと「3 / 35」だけにする。
export function Pager({
  page,
  total,
  perPage,
  onChange,
  label,
  className,
}: {
  page: number;
  total: number;
  perPage: number;
  onChange: (page: number) => void;
  label: string;
  className?: string;
}) {
  const count = pageCount(total, perPage);
  if (total <= perPage) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const n = (v: number) => v.toLocaleString("ja-JP");

  return (
    <nav
      aria-label={label}
      className={cn("flex flex-wrap items-center justify-between gap-2", className)}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {n(from)}〜{n(to)} 件 / {n(total)} 件
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="前のページ"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 text-xs tabular-nums sm:hidden">
          {page} / {count}
        </span>
        {pageItems(page, count).map((item, i) =>
          item === "gap" ? (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: 省略記号は位置で区別する
              key={`gap-${i}`}
              className="hidden w-6 text-center text-xs text-muted-foreground sm:inline"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "default" : "ghost"}
              size="icon-sm"
              aria-label={`${item} ページ目`}
              aria-current={item === page ? "page" : undefined}
              className="hidden min-w-7 w-auto px-1.5 tabular-nums sm:inline-flex"
              onClick={() => onChange(item)}
            >
              {item}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="次のページ"
          disabled={page >= count}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
