import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// 利用規約とプライバシーポリシー。
// 不動産情報ライブラリの API 利用規約 第 8 条により、アプリケーションの運営と責任が運営者にあることを明示する。

const OPERATOR = "合同会社Maa'un Japan";
const CONTACT_URL = "https://www.instagram.com/akiya_hudosan_maaunjapan/";
const ESTABLISHED = "2026年10月16日";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <div className="flex flex-col gap-6 text-sm leading-7 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
      <p className="text-sm text-muted-foreground">制定日: {ESTABLISHED}</p>
    </article>
  );
}

function Contact() {
  return (
    <p>
      本サービスに関するお問い合わせは、運営者の Instagram（
      <a className="underline underline-offset-2" href={CONTACT_URL} target="_blank" rel="noopener">
        @akiya_hudosan_maaunjapan
      </a>
      ）へのダイレクトメッセージで受け付けます。
    </p>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <p>
        {OPERATOR}
        （以下「運営者」）は、マチノメ（以下「本サービス」）における利用者の情報を、個人情報の保護に関する法律その他の法令に従い、以下のとおり取り扱います。
      </p>
      <section>
        <h2>1. 取得する情報</h2>
        <ul>
          <li>
            ログインした場合: 認証サービス Clerk が、Google
            アカウントの氏名・メールアドレス・プロフィール画像を受け取ります。運営者のデータベースには、Clerk
            が発行する利用者 ID だけを保存します。
          </li>
          <li>保存機能を使った場合: お気に入りの市区町村、比較リスト、保存した絞り込み条件。</li>
          <li>
            ログインしない閲覧では、利用者を特定する情報を取得しません。比較リストは利用者のブラウザ内に保存します。
          </li>
          <li>
            不正アクセスの調査のため、アクセスの日時・接続元の IP アドレス・アクセス先の URL
            を記録します。
          </li>
        </ul>
      </section>
      <section>
        <h2>2. 利用目的</h2>
        <ul>
          <li>ログインの状態を保ち、保存した内容を表示するため</li>
          <li>不正な利用を防ぎ、障害や不正アクセスを調査するため</li>
        </ul>
      </section>
      <section>
        <h2>3. 外部サービスへの委託と外国にある第三者への提供</h2>
        <p>
          運営者は、上記の目的のため、次の事業者に情報の取り扱いを委託します。どちらもアメリカ合衆国の事業者で、情報はアメリカ合衆国を含む国外のサーバーで取り扱われることがあります。
        </p>
        <ul>
          <li>認証: Clerk, Inc.（アメリカ合衆国）</li>
          <li>保存内容とアクセス記録の保管: Google LLC（Google Cloud、アメリカ合衆国）</li>
        </ul>
        <p>
          アメリカ合衆国には、日本の個人情報保護法に相当する連邦法はなく、州ごとの法令（カリフォルニア州消費者プライバシー法など）があります。各事業者は、それぞれのプライバシーポリシーとデータ処理に関する契約に基づいて情報を保護しています。法令に基づく場合を除き、これ以外の第三者に提供しません。
        </p>
      </section>
      <section>
        <h2>4. Cookie</h2>
        <p>
          ログインの状態を保つため、Clerk の Cookie を使います。アクセス解析や広告のための Cookie
          は使いません。
        </p>
      </section>
      <section>
        <h2>5. 開示・訂正・削除</h2>
        <p>
          アカウントを削除すると、本サービスに保存した内容も削除します。削除はユーザーメニューの「アカウントを管理」から行えます。保有する情報の開示・訂正・利用停止等のご請求は、下記の窓口で受け付けます。
        </p>
      </section>
      <section>
        <h2>6. お問い合わせ</h2>
        <Contact />
      </section>
      <section>
        <h2>7. 改定</h2>
        <p>本ポリシーを改定する場合は、本ページで告知します。</p>
      </section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="利用規約">
      <p>
        この規約は、{OPERATOR}
        （以下「運営者」）が提供する
        マチノメ（以下「本サービス」）の利用条件を定めます。利用者は本規約に同意のうえ本サービスを利用するものとします。
      </p>
      <section>
        <h2>1. 本サービスの運営と責任</h2>
        <p>
          本サービスは運営者が開発・運営するもので、その責任は運営者が負います。本サービスは、国土交通省「不動産情報ライブラリ」および政府統計の総合窓口（e-Stat）の
          API
          機能を使用していますが、国土交通省その他の国の機関が運営・保証・監修するものではありません。
        </p>
      </section>
      <section>
        <h2>2. 提供する情報</h2>
        <p>
          本サービスは、上記の公的データを集計して表示します。表示する指標はエリア選びの目安であり、個別の物件の価格や収益、投資判断を保証するものではありません。不動産取引時の重要事項説明や各種手続きに用いることは想定していません。
        </p>
      </section>
      <section>
        <h2>3. 出典</h2>
        <ul>
          <li>
            出典：国土交通省
            不動産情報ライブラリ（https://www.reinfolib.mlit.go.jp/）。取引価格の中央値・推移・想定利回りは「不動産取引価格情報」（国土交通省）をもとに運営者が作成したものです。駅ごとの取引相場の駅名・路線名は、同ライブラリから取得した「国土数値情報（駅別乗降客数データ）」（国土交通省）のうち、位置の近い駅を付けたものです。
          </li>
          <li>
            空き家率・家賃・人口は、政府統計の総合窓口（e-Stat）の統計データをもとに運営者が集計したものです。
          </li>
          <li>
            地図の背景には国土地理院の地理院タイルを使用しています。背景を「建物」に切り替えたときは、OpenFreeMap（https://openfreemap.org/）のタイルを使用しています（©
            OpenMapTiles、© OpenStreetMap contributors）。
          </li>
          <li>
            地図の市区町村の境界は、国土数値情報（行政区域データ）（国土交通省）（https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html）をもとに合同会社Maa'un
            Japan 作成。頂点を間引いて軽くしたもので、元のデータの境界と一致しない箇所があります。
          </li>
        </ul>
      </section>
      <section>
        <h2>4. 禁止事項</h2>
        <ul>
          <li>本サービスへの過度な負荷をかける行為（自動化された大量のアクセスなど）</li>
          <li>本サービスの運営を妨げる行為、不正にアクセスする行為</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>
      </section>
      <section>
        <h2>5. 免責</h2>
        <p>
          運営者は、表示する情報の正確性・完全性・最新性を保証しません。本サービスの利用により利用者に生じた損害について、運営者の故意または重大な過失による場合を除き、責任を負いません。
        </p>
      </section>
      <section>
        <h2>6. 変更・停止</h2>
        <p>
          運営者は、本サービスの内容を変更し、または提供を停止・終了することがあります。本規約を改定する場合は、本ページで告知します。
        </p>
      </section>
      <section>
        <h2>7. お問い合わせ</h2>
        <Contact />
      </section>
      <section>
        <h2>8. 準拠法</h2>
        <p>本規約は日本法に準拠します。</p>
      </section>
    </LegalLayout>
  );
}

export function NotFoundPage() {
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

// 公開前のアクセス制限で拒否したときにロードバランサが返すページ。
export function UnauthorizedPage() {
  return (
    <section className="flex flex-col items-center gap-4 text-center">
      <Badge variant="secondary">401</Badge>
      <h1 className="text-2xl font-bold tracking-tight">認証が必要です</h1>
      <p className="text-muted-foreground">このサイトは公開準備中です。</p>
    </section>
  );
}
