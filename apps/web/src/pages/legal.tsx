import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// 利用規約とプライバシーポリシー。文面は案で、公開前に確定する（仕様書の「先にやること」）。
// 確定していない項目は【要確認】として残している。

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit">
          案（公開前に確定します）
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>
      <div className="flex flex-col gap-6 text-sm leading-7 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="プライバシーポリシー">
      <p>
        area-insight（以下「本サービス」）は、利用者の情報を以下のとおり取り扱います。運営者は【要確認:
        運営者名】です。
      </p>
      <section>
        <h2>1. 取得する情報</h2>
        <ul>
          <li>
            ログインした場合: 認証サービス Clerk が Google
            アカウントの氏名・メールアドレス・プロフィール画像を受け取ります。
            本サービス自身のデータベースには、Clerk が発行する利用者 ID だけを保存します。
          </li>
          <li>保存機能を使った場合: お気に入りの市区町村、比較リスト、保存した絞り込み条件。</li>
          <li>
            ログインしない閲覧では、利用者を特定する情報を取得しません。比較リストは利用者のブラウザ内に保存します。
          </li>
        </ul>
      </section>
      <section>
        <h2>2. 利用目的</h2>
        <ul>
          <li>ログインの状態を保ち、保存した内容を表示するため</li>
          <li>不正な利用を防ぐため</li>
        </ul>
      </section>
      <section>
        <h2>3. 外部サービスへの提供</h2>
        <p>
          認証に Clerk（Clerk, Inc.）、保存内容の保管に Google Cloud（Google LLC）を利用します。
          法令に基づく場合を除き、これ以外の第三者に提供しません。【要確認:
          各社の所在国と越境移転の記載】
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
        <h2>5. 削除</h2>
        <p>
          アカウントを削除すると、本サービスに保存した内容も削除します。削除はユーザーメニューの「アカウントを管理」から行えます。
        </p>
      </section>
      <section>
        <h2>6. お問い合わせ</h2>
        <p>【要確認: 問い合わせ窓口】</p>
      </section>
      <p className="text-muted-foreground">制定日: 【要確認】</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="利用規約">
      <p>
        この規約は、area-insight（以下「本サービス」）の利用条件を定めます。利用者は本規約に同意のうえ利用するものとします。
      </p>
      <section>
        <h2>1. 提供する情報</h2>
        <p>
          本サービスは、国土交通省「不動産情報ライブラリ」および政府統計の総合窓口（e-Stat）が公開するデータを集計して表示します。
          表示する指標はエリア選びの目安であり、個別の物件の価格や収益、投資判断を保証するものではありません。
        </p>
      </section>
      <section>
        <h2>2. 出典</h2>
        <p>【要確認: 各データの利用規約に定める出典表示の文言】</p>
      </section>
      <section>
        <h2>3. 禁止事項</h2>
        <ul>
          <li>本サービスへの過度な負荷をかける行為（自動化された大量のアクセスなど）</li>
          <li>法令または公序良俗に反する行為</li>
        </ul>
      </section>
      <section>
        <h2>4. 免責</h2>
        <p>
          運営者は、表示する情報の正確性・完全性を保証せず、本サービスの利用により生じた損害について責任を負いません。
          【要確認: 消費者契約法との関係】
        </p>
      </section>
      <section>
        <h2>5. 変更・停止</h2>
        <p>
          運営者は、事前の通知なく本サービスの内容を変更し、または提供を停止することがあります。
        </p>
      </section>
      <p className="text-muted-foreground">制定日: 【要確認】</p>
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
