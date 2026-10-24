# area-insight

公的データ（国土交通省 不動産情報ライブラリ、e-Stat）をバッチで取得し、市区町村ごとの
不動産エリア情報を一般ユーザー向けに表示する Web サービス。サービス名は「マチノメ」、URL は
https://machinome.maa-un.com 。

インフラ（BigQuery、Cloud Storage、Firestore、ロードバランサ など）は
[maa-un/maaun-terraform](https://github.com/maa-un/maaun-terraform) の `envs/dev/gcp` で管理する。

## 構成

| ディレクトリ | 内容 | 配信 |
|---|---|---|
| `apps/batch` | 公的データを取得して BigQuery に保存するバッチ | GitHub Actions（標準ランナー） |
| `apps/api` | ログインユーザーのお気に入り等を Firestore に保存する API | イメージ → Cloud Run |
| `apps/web` | 画面（React + Vite + shadcn/ui）。全ページをビルド時に HTML に書き出す | Cloud Storage + Cloud CDN |
| `packages/shared` | 3 つで共有する型と zod スキーマ | — |

## 開発

Node.js は `.nvmrc` のバージョン（22.12 以上が必須）、パッケージマネージャは pnpm を使う。

```bash
corepack enable
pnpm install
pnpm lint        # Biome
pnpm typecheck
pnpm test        # Vitest
pnpm build
pnpm --filter @area-insight/web dev   # 画面をローカルで開く
```

イメージをローカルでビルドする場合はリポジトリのルートをコンテキストにする。

```bash
docker build -f apps/api/Dockerfile -t area-insight-api:local .
```

## リリースとデプロイ

| 契機 | ワークフロー | 処理 |
|---|---|---|
| PR | `ci.yml` | lint・型チェック・テスト・ビルド、イメージのビルド確認 |
| `main` へのマージ、手動 | `deploy.yml` | `ci.yml` を通してから、画面のデプロイと、版が上がっていれば保存 API のリリース |
| 定期実行、手動 | `batch.yml` | 取得 → 集計 → `web.yml` を呼んで画面更新 |
| データ更新の通知（移行中の旧 Workflows） | `deploy.yml` | 画面だけを作り直す |

`deploy.yml` の中身:

- **画面**: ビルドしてサイト用バケットへ配置し、CDN キャッシュを消す（マージのたびに行う）
- **保存 API**: ルートの `package.json` の `version` に対応するタグ（`vX.Y.Z`）がまだ無ければ、
  イメージを Artifact Registry へ push し、タグと GitHub Release を作る。タグが既にあれば何もしない

保存 API の**稼働バージョンは maaun-terraform の tfvars で指定する。**
イメージを push しただけでは切り替わらない。

リリース手順:

1. ルートの `package.json` の `version` を上げる（機能の PR に含めてよい）。マージするとイメージの push とタグ付けまで自動で行う
2. maaun-terraform で使うタグを変える PR を作り、plan して apply する

GitHub Actions は Workload Identity 連携で GCP に入る（鍵ファイルは持たない）。
使う値はリポジトリの Actions variables に登録している。
バッチの設定・定期実行・移行手順は [Actions への移行](docs/batch-actions.md) を参照。

## ログイン（Clerk）を PropFolio と共通にする

ログインは PropFolio と同じ Clerk の本番アプリ（Prop Folio、Frontend API は `https://clerk.maa-un.com`）を使う。
machinome.maa-un.com は Clerk に登録したドメイン maa-un.com のサブドメインなので、DNS やドメインの追加は要らず、
片方でログインすればもう片方でもログイン済みになる。ユーザー ID も共通になる。

開発インスタンス（`pk_test_`）から移ると、開発インスタンスのユーザーと、その ID で保存したお気に入り等は引き継がれない。

1. **Webhook**: Prop Folio アプリの Webhooks に `https://machinome.maa-un.com/api/webhooks/clerk` を追加し、`user.deleted` を購読する。
   表示された署名鍵（`whsec_...`）を Secret Manager の `clerk-webhook-secret` に新しいバージョンとして登録する
2. **保存 API**: maaun-terraform の `envs/dev/gcp/app/terraform.tfvars` で `clerk_issuer` を
   `https://clerk.maa-un.com` に変えて `make apply CLOUD=gcp LAYER=app` する（CSP の許可先も同じ値から作られる）
3. **画面**: GitHub の Variables の `CLERK_PUBLISHABLE_KEY` を Prop Folio の公開キー（`pk_live_...`）に変え、
   `deploy.yml` を手動で実行する
4. **確認**: `https://machinome.maa-un.com` で Google ログイン → お気に入りの保存 → 再読み込みで残ることを確かめる。
   PropFolio でログイン済みのブラウザで開くと、最初からログイン済みになることも確かめる

2 と 3 の間は、画面（開発インスタンス）と保存 API（本番）が食い違い、保存が失敗する。続けて行う。

Prop Folio アプリはメールアドレスとパスワードでのログインも有効なので、マチノメのログイン画面にも出る。

## ドメインを gc.maa-un.com から machinome.maa-un.com に移す

machinome.maa-un.com も maa-un.com のサブドメインなので、Clerk のドメイン設定は変えなくてよい。

1. **インフラ**: maaun-terraform で machinome.maa-un.com の DNS・証明書・ロードバランサのホストを追加し、
   gc.maa-un.com は同じパスのまま machinome.maa-un.com へ 301 で転送する
2. **Webhook**: Prop Folio アプリの Webhooks の URL を `https://machinome.maa-un.com/api/webhooks/clerk` に変える
3. **画面**: この変更をマージしてデプロイする（sitemap と canonical が新しいドメインになる）
4. **確認**: 新しいドメインでログインとお気に入りの保存ができること、gc.maa-un.com の各ページが転送されることを確かめる

画面の保存データ（比較リストなど）はブラウザのドメインごとに分かれるため、移った後は引き継がれない。
