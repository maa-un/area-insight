# area-insight

一般ユーザー向けの不動産エリア分析サービス。仕様は Claude Docs の「area-insight 仕様書」にある。

## 構成と責務

- `apps/batch`: 公的 API を呼ぶのはバッチだけ。取得したデータは**加工せず** BigQuery に保存する
  （集計は BigQuery 上で行う）。ロードジョブの `WRITE_TRUNCATE` で同じ範囲を置き換え、何度実行しても結果が同じになるようにする
  - ジョブ（`src/jobs`）は取得元と保存先のポート（`src/ports.ts`）にだけ依存する。実装は `src/adapters`
    （不動産情報ライブラリ、BigQuery）に置き、`src/main.ts` で組み立てる
- `apps/api`: 保存 API。Clerk のセッショントークンを検証し、本人のデータだけを読み書きする
  - クリーンアーキテクチャで層を分ける。依存は外から内への一方向（adapters → application → domain）
    - `src/domain`: 保存内容の集約（`UserPreferences`）・値オブジェクト・リポジトリのポート。業務の決まりはここに置き、
      外部ライブラリ・実行環境に依存しない
    - `src/application`: ユースケース（`PreferencesService`）と、外の仕組みに求めるポート（トークン検証、アカウントの出来事）
    - `src/adapters`: HTTP、Firestore、Clerk など外の仕組みとの接続。認証サービス固有の形はここで内側の形に変換する
    - `src/main.ts`: 実装を選んで組み立てる唯一の場所
  - 依存の向きは Biome の `noRestrictedImports`（`biome.json` の `overrides`）で強制している
- `apps/web`: 画面。全ページをビルド時に静的生成し、CDN から配る。アクセス時にサーバーも BigQuery も動かさない
  - UI は shadcn/ui（Tailwind CSS v4 + Radix UI、アイコンは lucide）。部品は `pnpm dlx shadcn@<固定版> add <名前>` で
    `src/components/ui` にコピーして使い、UI/UX の質を重視する
  - ログインは Clerk（Google SSO のみ）。`src/lib/auth.ts` が Clerk 本体を必要なときだけ読み込む
    （ログインボタンを押したとき、またはログイン済みの Cookie があるとき）。閲覧だけの人には読み込ませない
- `packages/shared`: 型と zod スキーマ。外部から来るデータ（API 応答、リクエスト本文）は必ず zod で検証する

インフラは maaun-terraform で管理する。このリポジトリにインフラ定義を置かない。

## 規約

- 依存は最小限にする。フレームワーク（Next.js など）やルーティングのライブラリは使わない。
  バージョンは固定し、更新は PR で確認する
- TypeScript は strict。lint と整形は Biome（`pnpm format` で自動修正）
- 秘匿情報（API キー、トークン、Webhook の署名鍵）をコード・ログに出さない。
  環境変数の検証エラーでも値は出さず変数名だけを示す
- 個人を特定できる情報（ユーザー ID、メールアドレス、リクエスト本文）をログに出さない
- Gitブランチは `feat/`、`fix/`、`ci/`、`chore/`、`docs/`、`refactor/` を使う
- GitHub PR のタイトルと本文は日本語。タイトルは Conventional Commit 形式の prefix を付ける
- コミット前に `pnpm lint && pnpm typecheck && pnpm test` を通す

## イメージとデプロイ

- バッチと保存 API のイメージは `vX.Y.Z` タグで Artifact Registry に push する。
  タグとルートの `package.json` の `version` は一致させる
- 稼働させるタグは maaun-terraform の tfvars で指定する。CI から Cloud Run を直接更新しない
- 画面は `deploy-web.yml` がサイト用バケットへ置く。ハッシュ付きの assets を先に、HTML を後に置く
