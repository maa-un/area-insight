import { ArrowLeft, Columns3, ListOrdered, Map as MapIcon, MapPin, Search } from "lucide-react";
import type { ComponentType } from "react";
import { AuthMenu } from "@/components/auth-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export type Page = "home" | "not-found" | "unauthorized";

export function App({ page }: { page: Page }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:py-16">
        {page === "home" ? <Home /> : page === "unauthorized" ? <Unauthorized /> : <NotFound />}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <MapPin className="size-5 text-primary" aria-hidden />
          area-insight
        </a>
        <AuthMenu />
      </div>
    </header>
  );
}

const entries: { title: string; body: string; icon: ComponentType<{ className?: string }> }[] = [
  { title: "地図で探す", body: "地価や駅ごとの相場を、周辺の市区町村と見比べる", icon: MapIcon },
  {
    title: "ランキングで探す",
    body: "取引単価や空き家率で絞り込み、条件に合う市区町村を並べる",
    icon: ListOrdered,
  },
  { title: "比較する", body: "気になる市区町村を 3 つまで横に並べて比べる", icon: Columns3 },
];

function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-center gap-5 text-center">
        <Badge variant="secondary">全国の市区町村を公的データで</Badge>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          どの市区町村で探すか、公的データで比べる
        </h1>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          取引価格・地価・空き家率・人口の推移を、市区町村ごとに見比べられます。物件を探す前のエリア選びにお使いください。
        </p>
        <form className="flex w-full max-w-md gap-2" onSubmit={(event) => event.preventDefault()}>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="市区町村名で検索（準備中）"
              aria-label="市区町村名で検索"
              disabled
            />
          </div>
          <Button type="submit" disabled>
            検索
          </Button>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="探し方">
        {entries.map(({ title, body, icon: Icon }) => (
          <Card key={title} className="transition-colors hover:bg-muted/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-primary" aria-hidden />
                <Badge variant="outline">準備中</Badge>
              </div>
              <CardTitle className="mt-2">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}

function NotFound() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <Badge variant="secondary">404</Badge>
      <h1 className="text-2xl font-bold tracking-tight">ページが見つかりません</h1>
      <p className="text-muted-foreground">
        URL が変わったか、ページが削除された可能性があります。
      </p>
      <Button asChild variant="outline">
        <a href="/">
          <ArrowLeft />
          トップへ戻る
        </a>
      </Button>
    </section>
  );
}

// 開発中に Basic 認証で保護している間、ロードバランサが 401 と一緒に返すページ。
function Unauthorized() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <Badge variant="secondary">401</Badge>
      <h1 className="text-2xl font-bold tracking-tight">認証が必要です</h1>
      <p className="text-muted-foreground">
        このサイトは公開準備中です。案内された ID とパスワードでアクセスしてください。
      </p>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pb-8 text-xs text-muted-foreground">
      <Separator className="mb-6" />
      <p>
        出典: 国土交通省 不動産情報ライブラリ、e-Stat（表示する文言は利用規約を確認して確定する）
      </p>
      <p className="mt-1">掲載する指標は目安であり、投資判断を保証するものではありません。</p>
    </footer>
  );
}
