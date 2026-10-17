import {
  Building2,
  Columns3,
  FlaskConical,
  Home,
  ListOrdered,
  Map as MapIcon,
  MapPin,
  Search,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { AuthMenu } from "@/components/auth-menu";
import { openSearch, SearchDialog } from "@/components/search-dialog";
import { Kbd } from "@/components/ui/kbd";
import { dataset } from "@/data";
import { formatDate } from "@/lib/format";
import { useUserData } from "@/lib/user-data";
import { cn } from "@/lib/utils";
import { comparePath, type PageName } from "@/routes";

const NAV: {
  page: PageName;
  label: string;
  short: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { page: "home", label: "ホーム", short: "ホーム", href: "/", icon: Home },
  { page: "map", label: "地図で探す", short: "地図", href: "/map/", icon: MapIcon },
  {
    page: "condos",
    label: "マンション成約事例",
    short: "成約事例",
    href: "/condos/",
    icon: Building2,
  },
  {
    page: "rankings",
    label: "ランキング",
    short: "ランキング",
    href: "/rankings/",
    icon: ListOrdered,
  },
  { page: "compare", label: "比較", short: "比較", href: "/compare/", icon: Columns3 },
];

// アプリの外枠。広い画面は左のサイドバー、狭い画面は上のバーと下のタブバーで移動する。
// ページを移るときは本文（vt-page）だけを入れ替え、サイドバーとタブバーは動かさない。
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
    <div className="min-h-svh bg-background text-foreground lg:pl-64">
      <Sidebar page={page} />
      <MobileHeader />
      {dataset.sample && <SampleNotice className="lg:hidden" />}
      <div className="vt-page flex min-h-svh flex-col pb-20 lg:pb-0">
        <main
          className={cn(
            "mx-auto w-full flex-1",
            wide ? "max-w-none" : "max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10",
          )}
        >
          {children}
        </main>
        <SiteFooter />
      </div>
      <TabBar page={page} />
      <SearchDialog />
    </div>
  );
}

function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        "group flex shrink-0 items-center gap-2.5 font-bold tracking-tight whitespace-nowrap",
        className,
      )}
    >
      <span className="relative flex size-8 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-primary to-[oklch(0.5_0.15_32)] text-primary-foreground shadow-sm shadow-primary/30 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <MapPin className="size-4.5" aria-hidden />
      </span>
      マチノメ
    </a>
  );
}

function useNavHref() {
  const { compare } = useUserData();
  return {
    compare,
    hrefOf: (item: (typeof NAV)[number]) =>
      item.page === "compare" ? comparePath(compare) : item.href,
  };
}

function Sidebar({ page }: { page: PageName }) {
  const { compare, hrefOf } = useNavHref();
  return (
    <aside className="vt-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={openSearch}
          className="flex h-9 w-full items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-all hover:border-primary/40 hover:text-foreground hover:shadow-sm"
        >
          <Search className="size-4" aria-hidden />
          市区町村を検索
          <Kbd className="ml-auto">⌘K</Kbd>
        </button>
      </div>
      <nav aria-label="メイン" className="mt-5 flex flex-col gap-0.5 px-3">
        <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wider text-muted-foreground">
          メニュー
        </p>
        {NAV.map((item) => {
          const current = page === item.page;
          return (
            <a
              key={item.page}
              href={hrefOf(item)}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                current && "bg-card text-foreground shadow-xs ring-1 ring-border",
              )}
            >
              {current && (
                <span
                  className="absolute top-1/2 -left-3 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary animate-in fade-in slide-in-from-left-1"
                  aria-hidden
                />
              )}
              <item.icon
                className={cn(
                  "size-4 transition-transform duration-200 group-hover:scale-110",
                  current && "text-primary",
                )}
                aria-hidden
              />
              {item.label}
              {item.page === "compare" && compare.length > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums animate-in zoom-in">
                  {compare.length}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-3 p-3">
        {dataset.sample && <SampleNotice compact />}
        <p className="px-2 text-[11px] text-muted-foreground">
          データ更新 {formatDate(dataset.updatedAt)}
        </p>
        <div className="flex items-center border-t px-2 pt-3 empty:hidden">
          <AuthMenu />
        </div>
      </div>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="vt-sidebar sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-xl lg:hidden">
      <Logo />
      <button
        type="button"
        onClick={openSearch}
        aria-label="市区町村を検索"
        className="ml-auto flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-5" aria-hidden />
      </button>
      <AuthMenu />
    </header>
  );
}

function TabBar({ page }: { page: PageName }) {
  const { compare, hrefOf } = useNavHref();
  return (
    <nav
      aria-label="メイン（下部）"
      className="vt-tabbar fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {NAV.map((item) => {
          const current = page === item.page;
          return (
            <a
              key={item.page}
              href={hrefOf(item)}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95",
                current && "text-primary",
              )}
            >
              <span
                className={cn(
                  "relative flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300",
                  current && "bg-primary/12",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.page === "compare" && compare.length > 0 && (
                  <span className="absolute -top-1 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground tabular-nums">
                    {compare.length}
                  </span>
                )}
              </span>
              {item.short}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

// API キーが届くまでの間、サンプルデータで表示していることを全ページで明示する。
function SampleNotice({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <p className="flex gap-2 rounded-lg border border-primary/25 bg-accent p-3 text-xs leading-relaxed text-accent-foreground">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        開発中のため、数値はすべてサンプル（架空の値）です。実際の相場ではありません。
      </p>
    );
  }
  return (
    <div className={cn("border-b border-primary/20 bg-accent text-accent-foreground", className)}>
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-xs">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        開発中のため、数値はすべてサンプル（架空の値）です。実際の相場ではありません。
      </p>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 text-xs leading-relaxed text-muted-foreground sm:px-6 lg:px-10">
        <div className="flex flex-col gap-1">
          <p>
            データの更新日: {formatDate(dataset.updatedAt)}
            （指標ごとの時点は各数字のそばに示します）
          </p>
          <p>掲載する指標は目安であり、投資判断を保証するものではありません。</p>
        </div>
        <Credits />
        <div className="mt-4 flex gap-4">
          <a
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/terms/"
          >
            利用規約
          </a>
          <a
            className="font-medium text-foreground underline-offset-4 hover:underline"
            href="/privacy/"
          >
            プライバシーポリシー
          </a>
        </div>
      </div>
    </footer>
  );
}

// 出典とクレジット。文言は各データの利用規約が指定するものをそのまま使う。
//   不動産情報ライブラリ: 利用規約「コンテンツの利用に係るPDL1.0に関する重要情報」と API 利用規約 第 7 条
//   e-Stat: API 機能のクレジット表示（https://www.e-stat.go.jp/api/api-info/credit）
//   地理院タイル: 国土地理院の地理院タイル利用規約
//   国土数値情報（駅別乗降客数）: 不動産情報ライブラリの API（XKT015）から取得するため、同ライブラリの出典に含まれる。
//     どのデータで駅名を付けたかが分かるよう、取引価格の作成の注記に添える
//   国土数値情報（行政区域）: CC BY 4.0（PDL1.0 の追加記載例どおり、加工したことと作成者を示す）
//   社人研（将来推計人口）: PDL1.0（出典を記載し、加工したことを示す）
const link = "underline underline-offset-2 hover:text-foreground";

function Credits() {
  return (
    <div className="mt-4 flex flex-col gap-1">
      <p>
        出典：国土交通省 不動産情報ライブラリ（
        <a className={link} href="https://www.reinfolib.mlit.go.jp/" target="_blank" rel="noopener">
          https://www.reinfolib.mlit.go.jp/
        </a>
        ）、政府統計の総合窓口（e-Stat）、
        <a
          className={link}
          href="https://maps.gsi.go.jp/development/ichiran.html"
          target="_blank"
          rel="noopener"
        >
          地理院タイル
        </a>
        （国土地理院）
      </p>
      <p>
        取引価格の中央値・推移・想定利回りは「不動産取引価格情報」（国土交通省）をもとに合同会社Maa'un
        Japan
        が作成しました。駅ごとの取引相場の駅名・路線名は「国土数値情報（駅別乗降客数データ）」（国土交通省）から、位置の近い駅を付けたものです。
      </p>
      <p>
        地図の市区町村の境界：
        <a
          className={link}
          href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html"
          target="_blank"
          rel="noopener"
        >
          国土数値情報（行政区域データ）
        </a>
        （国土交通省）をもとに合同会社Maa'un Japan 作成
      </p>
      <p>
        将来の人口は「日本の地域別将来推計人口（令和5（2023）年推計）」（
        <a className={link} href="https://www.ipss.go.jp/" target="_blank" rel="noopener">
          国立社会保障・人口問題研究所
        </a>
        ）をもとに合同会社Maa'un Japan が加工しました。
      </p>
      <p>
        このサービスは、国土交通省の不動産情報ライブラリのAPI機能を使用していますが、提供情報の最新性、正確性、完全性等が保証されたものではありません。
      </p>
      <p>
        このサービスは、政府統計総合窓口(e-Stat)のAPI機能を使用していますが、サービスの内容は国によって保証されたものではありません。
      </p>
    </div>
  );
}
