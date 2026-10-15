import { FlaskConical, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { AuthMenu } from "@/components/auth-menu";
import { Separator } from "@/components/ui/separator";
import { dataset } from "@/data";
import { formatDate } from "@/lib/format";
import { useUserData } from "@/lib/user-data";
import { cn } from "@/lib/utils";
import { comparePath, type PageName } from "@/routes";

const NAV: { page: PageName; label: string; href: string }[] = [
  { page: "map", label: "地図", href: "/map/" },
  { page: "rankings", label: "ランキング", href: "/rankings/" },
  { page: "compare", label: "比較", href: "/compare/" },
];

export function SiteLayout({
  page,
  wide = false,
  children,
}: {
  page: PageName;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader page={page} />
      {dataset.sample && <SampleNotice />}
      <main
        className={cn(
          "mx-auto w-full flex-1 px-4",
          wide ? "max-w-none py-0 sm:px-0" : "max-w-5xl py-8 sm:py-12",
        )}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ page }: { page: PageName }) {
  const { compare } = useUserData();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:gap-4">
        <a
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight whitespace-nowrap"
        >
          <MapPin className="size-5 text-primary" aria-hidden />
          area-insight
        </a>
        <nav
          aria-label="メイン"
          className="ml-auto flex items-center gap-0.5 text-sm whitespace-nowrap sm:gap-1"
        >
          {NAV.map((item) => (
            <a
              key={item.page}
              href={item.page === "compare" ? comparePath(compare) : item.href}
              aria-current={page === item.page ? "page" : undefined}
              className={cn(
                "rounded-md px-2 py-1.5 text-muted-foreground sm:px-2.5 transition-colors hover:bg-muted hover:text-foreground",
                page === item.page && "bg-muted font-medium text-foreground",
              )}
            >
              {item.label}
              {item.page === "compare" && compare.length > 0 && (
                <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
                  {compare.length}
                </span>
              )}
            </a>
          ))}
        </nav>
        <AuthMenu />
      </div>
    </header>
  );
}

// API キーが届くまでの間、サンプルデータで表示していることを全ページで明示する。
function SampleNotice() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-xs sm:text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        開発中のため、数値はすべてサンプル（架空の値）です。実際の相場ではありません。
      </p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-muted-foreground">
      <Separator className="mb-6" />
      <div className="flex flex-col gap-1">
        <p>データの基準日: {formatDate(dataset.asOf)}</p>
        <p>
          出典: 国土交通省 不動産情報ライブラリ、政府統計の総合窓口（e-Stat）、地理院タイル
          （表示する文言は利用規約を確認して確定する）
        </p>
        <p>掲載する指標は目安であり、投資判断を保証するものではありません。</p>
      </div>
      <div className="mt-4 flex gap-4">
        <a className="underline-offset-4 hover:underline" href="/terms/">
          利用規約
        </a>
        <a className="underline-offset-4 hover:underline" href="/privacy/">
          プライバシーポリシー
        </a>
      </div>
    </footer>
  );
}
