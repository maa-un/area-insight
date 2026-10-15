# area-insight

公的データ（国土交通省 不動産情報ライブラリ、e-Stat）をバッチで取得し、市区町村ごとの
不動産エリア情報を一般ユーザー向けに表示する Web サービス。

インフラ（Cloud Run Jobs、BigQuery、Cloud Storage、Firestore、ロードバランサ など）は
[maa-un/maaun-terraform](https://github.com/maa-un/maaun-terraform) の `envs/dev/gcp` で管理する。

## 構成

| ディレクトリ | 内容 | 配信 |
|---|---|---|
| `apps/batch` | 公的データを取得して BigQuery に保存するバッチ | イメージ → Cloud Run Jobs |
| `apps/api` | ログインユーザーのお気に入り等を Firestore に保存する API | イメージ → Cloud Run |
| `apps/web` | 画面（React + Vite）。全ページをビルド時に HTML に書き出す | Cloud Storage + Cloud CDN |
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
docker build -f apps/batch/Dockerfile -t area-insight-batch:local .
```

## リリースとデプロイ

| 対象 | 契機 | 処理 |
|---|---|---|
| 全体 | PR / `main` への push | `ci.yml`: lint・型チェック・テスト・ビルド、イメージのビルド確認 |
| バッチ・保存 API | `vX.Y.Z` タグの push | `release.yml`: イメージを Artifact Registry へ push |
| 画面 | `main` への push（`apps/web` 等の変更）、手動、データ更新の通知 | `deploy-web.yml`: ビルドしてサイト用バケットへ配置し、CDN キャッシュを消す |

バッチと保存 API の**稼働バージョンは maaun-terraform の tfvars で指定する。**
イメージを push しただけでは切り替わらない。

リリース手順:

1. ルートの `package.json` の `version` を上げる PR を作ってマージする
2. `main` で同じバージョンのタグを作って push する（例: `git tag v0.2.0 && git push origin v0.2.0`）
3. maaun-terraform で使うタグを変える PR を作り、plan して apply する

GitHub Actions は Workload Identity 連携で GCP に入る（鍵ファイルは持たない）。
使う値はリポジトリの Actions variables に登録している。
