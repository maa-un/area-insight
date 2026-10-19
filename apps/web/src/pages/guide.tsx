import { Building2, Columns3, ListOrdered, LogIn, Map as MapIcon, MapPinned } from "lucide-react";
import type { ComponentType } from "react";
import { Eyebrow } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { dataset } from "@/data";
import { openSignIn, useAuth } from "@/lib/auth";

// マチノメでできること。ログインしていない人にも見せる案内のページ。

const features: {
  title: string;
  body: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    title: "市区町村ごとの相場を見る",
    body: "中古戸建の取引価格とその推移、空き家率と空き家の内訳、人口の推移を、市区町村ごとにまとめて確かめられます。相場から収支の目安も計算できます。",
    icon: MapPinned,
  },
  {
    title: "地図で探す",
    body: "取引価格・地価公示の地点・駅ごとの取引相場を地図に重ね、周辺の市区町村と見比べられます。",
    icon: MapIcon,
  },
  {
    title: "マンションの成約事例を見る",
    body: "中古マンションの成約価格を最寄り駅ごとに地図で見られます。間取り・専有面積・築年数で絞り込めます。",
    icon: Building2,
  },
  {
    title: "ランキングで絞り込む",
    body: "取引価格・想定利回り・空き家率・人口増減率で市区町村を並べ替え、条件に合うエリアを探せます。",
    icon: ListOrdered,
  },
  {
    title: "並べて比べる",
    body: "気になる市区町村を 3 つまで横に並べて比べられます。ログインすると、お気に入りや比較リストを保存できます。",
    icon: Columns3,
  },
];

export function GuidePage() {
  const auth = useAuth();
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Eyebrow>マチノメでできること</Eyebrow>
        <h1 className="text-3xl font-bold tracking-tight">エリア選びを、公的データで</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          マチノメは、物件を探す前のエリア選びのための調査ツールです。全国{" "}
          {dataset.areas.length.toLocaleString("ja-JP")}{" "}
          の市区町村について、国土交通省「不動産情報ライブラリ」と政府統計の総合窓口（e-Stat）のデータを集計して表示します。
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {features.map(({ title, body, icon: Icon }) => (
          <li key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="font-semibold">{title}</span>
            <span className="text-sm leading-6 text-muted-foreground">{body}</span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-6 text-center">
        <p className="text-sm leading-7 text-muted-foreground">
          データ・地図・ランキングは、ログインした方だけが見られます。Google
          アカウントかメールアドレスでログインできます。
        </p>
        {/* ログイン済みの人にログインボタンが一瞬見えないよう、未ログインと分かったときだけ出す */}
        {auth.status === "signed-out" ? (
          <Button size="lg" onClick={() => void openSignIn()}>
            <LogIn />
            ログインして使う
          </Button>
        ) : (
          <Button asChild size="lg" variant="outline">
            <a href="/">トップへ</a>
          </Button>
        )}
      </section>
    </article>
  );
}
