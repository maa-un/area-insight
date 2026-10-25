import {
  ArrowRight,
  BookOpen,
  Building2,
  Calculator,
  CircleAlert,
  Columns3,
  Home,
  LandPlot,
  ListOrdered,
  LogIn,
  Map as MapIcon,
  Scale,
  Search,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Eyebrow, PageHeader } from "@/components/brand";
import { openSearch } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { dataset } from "@/data";
import { openSignIn, useAuth } from "@/lib/auth";

// 使い方。何を調べられて、どの画面で何ができるかをまとめる。
// ログインしていない人にも見せ、ログインすると何が見られるのかを伝える。

type Icon = ComponentType<{ className?: string }>;

// 調べられること（データの中身）。
const topics: { icon: Icon; title: string; body: string; items: string[] }[] = [
  {
    icon: TrendingUp,
    title: "中古戸建の取引価格",
    body: "実際に取引された価格から、その市区町村の相場をつかめます。",
    items: ["取引価格の中央値と推移（四半期・年）", "想定表面利回り", "直近の取引（地区名まで）"],
  },
  {
    icon: LandPlot,
    title: "土地の値段",
    body: "検討中の土地の坪単価が、相場と比べて高いか安いかを確かめられます。",
    items: [
      "坪単価の価格チェック",
      "地区ごと・駅ごとの坪単価",
      "公示地価との比較、駅からの距離ごとの地価",
    ],
  },
  {
    icon: Home,
    title: "空き家",
    body: "住宅・土地統計調査から、空き家の多さと増え方を見られます。",
    items: [
      "空き家率と放置空き家率",
      "5 年での空き家率の増減",
      "空き家の内訳（賃貸用・売却用など）",
    ],
  },
  {
    icon: Users,
    title: "人口",
    body: "人が増えている町か、減っている町かを、過去と将来の両方で見られます。",
    items: ["人口と 5 年の増減率", "人口の推移", "2050 年の将来推計"],
  },
  {
    icon: Building2,
    title: "マンションの成約事例",
    body: "中古マンションの成約価格を、最寄り駅ごとに地図で見られます。",
    items: ["駅ごとの坪単価の相場", "間取り・面積・築年数での絞り込み", "面積から仕入れ価格の目安"],
  },
  {
    icon: Scale,
    title: "市場の歪み",
    body: "指標を組み合わせて、相場が割安に見える市区町村を探す手がかりにします。",
    items: ["人口の割に家賃・土地が安い", "地価の上昇に取引が追いつかない", "取引価格 ÷ 公示地価"],
  },
];

// 画面ごとの使い方。
const screens: { icon: Icon; title: string; href?: string; when: string; steps: ReactNode[] }[] = [
  {
    icon: Search,
    title: "検索",
    when: "調べたい市区町村が決まっているとき",
    steps: [
      <>
        どの画面でも <Kbd>⌘K</Kbd>（Windows は <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd>）か上の検索ボタンで開く
      </>,
      "市区町村名を入れて選ぶと、その市区町村のページへ移る",
    ],
  },
  {
    icon: MapIcon,
    title: "地図で探す",
    href: "/map/",
    when: "まだ地域を絞れていないとき、周りと見比べたいとき",
    steps: [
      "取引価格・利回り・空き家率などの指標を選ぶと、市区町村が 5 段階に塗り分けられる",
      "拡大すると、地価公示の地点と駅ごとの相場も重ねて見られる",
      "市区町村を押すと概要が出て、詳しいページへ移れる",
    ],
  },
  {
    icon: ListOrdered,
    title: "ランキング",
    href: "/rankings/",
    when: "条件に合う市区町村を順に並べたいとき",
    steps: [
      "13 の指標から 1 つ選び、高い順・低い順に並べる",
      "都道府県で絞り込める。取引が少なく値がぶれやすい市区町村は、既定で除いている",
      "気になった行は「比較に追加」しておく",
    ],
  },
  {
    icon: Home,
    title: "市区町村のページ",
    when: "1 つの市区町村を詳しく調べたいとき",
    steps: [
      "主な指標と、都道府県の中での順位、ひとことの判定を最初に表示",
      "土地の坪単価を入れると、その地区の相場と比べて高いか安いかが分かる",
      "空き家・取引価格の推移・人口・近くの市区町村・直近の取引まで、1 ページで見られる",
    ],
  },
  {
    icon: Columns3,
    title: "比較",
    href: "/compare/",
    when: "候補を 2〜3 に絞ったとき",
    steps: [
      "最大 3 つの市区町村を横に並べ、同じ指標で見比べる",
      "指標ごとに良い方の値を強調する",
      "URL をそのまま共有すると、相手も同じ比較を開ける",
    ],
  },
  {
    icon: Building2,
    title: "マンション成約事例",
    href: "/condos/",
    when: "マンションの相場や仕入れ値を確かめたいとき",
    steps: [
      "都道府県・時期・間取り・面積・築年数で絞り込む",
      "駅ごとの円の色が坪単価、大きさが件数を表す",
      "専有面積を入れると、安め・中央・高めの価格の目安が出る",
    ],
  },
];

// よくある使い方の流れ。
const recipes: { title: string; steps: string[] }[] = [
  {
    title: "利回りの高いエリアを探す",
    steps: [
      "ランキングで「想定表面利回り」を選ぶ",
      "人口増減率や空き家率も見て、候補を比較に追加",
      "比較で 3 つを見比べる",
      "PropFolio で収支を計算する",
    ],
  },
  {
    title: "買おうとしている土地が高くないか確かめる",
    steps: [
      "検索で市区町村のページを開く",
      "土地の価格チェックに坪単価を入れる",
      "駅ごとの坪単価や公示地価とも見比べる",
    ],
  },
  {
    title: "マンションの仕入れ値の目安を知る",
    steps: [
      "マンション成約事例で都道府県と条件を選ぶ",
      "最寄り駅の円を押して相場を見る",
      "専有面積を入れて価格の目安を確かめる",
    ],
  },
];

export function GuidePage() {
  return (
    <div className="flex flex-col gap-12 lg:gap-16">
      <PageHeader
        icon={BookOpen}
        eyebrow="使い方"
        title="Maa'un 不動産取引事例でできること"
        description={`物件を探す前の「どの町で買うか」を決めるための調査ツールです。全国 ${dataset.areas.length.toLocaleString("ja-JP")} 市区町村の取引価格・地価・空き家・人口を、国の公的データで調べて比べられます。`}
        actions={<StartButton />}
      />

      <Section eyebrow="調べられること" title="市区町村ごとに、この 6 つが分かります">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map(({ icon: Icon, title, body, items }) => (
            <article key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
              <ul className="mt-auto flex flex-col gap-1.5 border-t pt-3 text-sm">
                {items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-terracotta"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="画面ごとの使い方" title="目的に合わせて画面を選ぶ">
        <div className="grid gap-3 md:grid-cols-2">
          {screens.map(({ icon: Icon, title, href, when, steps }) => (
            <article key={title} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col">
                  <h3 className="font-semibold">
                    {href ? (
                      <a
                        href={href}
                        className="group inline-flex items-center gap-1 hover:text-primary"
                      >
                        {title}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </a>
                    ) : (
                      title
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">{when}</p>
                </div>
              </div>
              <ol className="flex flex-col gap-2 text-sm">
                {steps.map((step, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 固定の手順で並びは変わらない
                  <li key={i} className="flex gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </Section>

      <Section eyebrow="使い方の例" title="よくある調べ方">
        <div className="grid gap-3 lg:grid-cols-3">
          {recipes.map(({ title, steps }) => (
            <article key={title} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
              <h3 className="font-semibold">{title}</h3>
              <ol className="relative flex flex-col gap-3 border-l border-dashed pl-5 text-sm">
                {steps.map((step) => (
                  <li key={step} className="relative">
                    <span
                      className="absolute top-1.5 -left-[1.4rem] size-2 rounded-full bg-terracotta ring-4 ring-card"
                      aria-hidden
                    />
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel icon={Star} title="ログインするとできること">
          <ul className="flex flex-col gap-2">
            <li>市区町村のデータ・地図・ランキング・比較をすべて見られます</li>
            <li>気になる市区町村をお気に入りに登録できます</li>
            <li>ランキングの絞り込み条件を名前を付けて保存できます</li>
            <li>比較リストを、ほかの端末でも同じ内容で開けます</li>
          </ul>
          <p className="text-muted-foreground">
            Google アカウントかメールアドレスでログインできます。
          </p>
        </Panel>
        <Panel icon={CircleAlert} title="使うときの注意">
          <ul className="flex flex-col gap-2">
            <li>
              数値はエリア選びの目安です。個別の物件の査定や、投資判断を保証するものではありません
            </li>
            <li>
              取引が 10 件未満の値は「参考値」として示します。件数が少ないとぶれやすいためです
            </li>
            <li>
              データの時点は指標ごとに違います。各数値の近くに、いつのデータかを記載しています
            </li>
          </ul>
          <p className="text-muted-foreground">
            出典はページ下部に、詳しくは
            <a className="underline underline-offset-2 hover:text-foreground" href="/terms/">
              利用規約
            </a>
            にまとめています。
          </p>
        </Panel>
      </div>

      <Panel icon={Calculator} title="収支の計算は PropFolio で">
        <p>
          市区町村のページと比較の「収支を計算」から、その相場をもとに関連サービスの PropFolio
          で収支を試算できます。
        </p>
      </Panel>
    </div>
  );
}

// 使い始めの入口。ログインしていなければログインを、していれば検索を勧める。
function StartButton() {
  const { status } = useAuth();
  if (status === "signed-out") {
    return (
      <Button size="lg" className="shrink-0" onClick={() => void openSignIn()}>
        <LogIn />
        ログインして使う
      </Button>
    );
  }
  return (
    <Button size="lg" className="shrink-0" onClick={openSearch}>
      <Search />
      市区町村を検索
    </Button>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-5 text-sm leading-7 [&_li]:ml-5 [&_li]:list-disc">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
