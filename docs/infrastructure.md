# インフラ構成図（Google Cloud）

正は [maa-un/maaun-terraform](https://github.com/maa-un/maaun-terraform) の `envs/dev/gcp`。リージョンは `asia-northeast1`（東京）。

- `platform` レイヤ: 長く使うもの（データ、バケット、DNS、証明書、SA、Secret）
- `app` レイヤ: 作り直せるもの（保存 API の Cloud Run、LB、Cloud Armor）

リソース名の `<prefix>` は Terraform の `name_prefix`。

## 構成図

```mermaid
flowchart TB
  user([利用者])
  subgraph actions[GitHub Actions]
    trigger[schedule / 手動]
    batch[batch.yml<br/>取得・集計 / 標準ランナー]
    gh[web.yml<br/>静的ビルド・配信]
    deploy[deploy.yml<br/>main マージ / API リリース]
  end
  clerkwh[Clerk Webhook]

  subgraph net[ネットワーク]
    dns[Cloud DNS<br/>machinome.maa-un.com]
    lb[外部 HTTPS LB<br/>固定 IP / マネージド証明書<br/>TLS1.2+ / セキュリティヘッダー]
    edge[Cloud Armor edge<br/>国・地域の制限 任意]
    armor[Cloud Armor<br/>120 回/分/IP]
  end

  subgraph serve[配信]
    cdn[Cloud CDN<br/>backend bucket]
    site[(GCS<br/>&lt;prefix&gt;-area-insight-site-*)]
    run[Cloud Run<br/>&lt;prefix&gt;-area-insight-api<br/>ingress: LB のみ]
    fs[(Firestore<br/>default / Native)]
  end

  subgraph upd[データ更新]
    bq[(BigQuery dataset<br/>&lt;prefix&gt;_area_insight)]
    data[(GCS<br/>&lt;prefix&gt;-area-insight-data-*)]
  end

  sm[Secret Manager]
  ar[Artifact Registry<br/>area-insight-api]
  mon[Cloud Monitoring<br/>API アラート 4 種]

  user --> dns --> lb
  lb -- "/*" --> edge --> cdn --> site
  lb -- "/api/*" --> armor --> run --> fs
  clerkwh --> lb

  trigger --> batch --> bq
  bq -- EXPORT DATA --> data
  batch -- 集計成功後 --> gh
  deploy --> gh
  gh -- exports を取得 --> data
  gh -- HTML / assets --> site
  deploy -- API イメージ push --> ar
  ar -.-> run
  sm -.-> batch & run
  run -.-> mon
```

## リソース一覧

| 種類 | 名前 | 役割 |
|---|---|---|
| BigQuery | `<prefix>_area_insight` | raw と集計のテーブル（[ER 図](er-diagram.md)） |
| GCS | `<prefix>-area-insight-data-<project>` | 書き出し `exports/` と分割取得用 `batch-staging/`。非公開。中間ファイルだけ7日保持 |
| GCS | `<prefix>-area-insight-site-<project>` | 静的サイト。読み取り公開。404 は `404.html` |
| Firestore | `(default)` | 利用者のデータ。削除保護あり |
| Cloud Run | `<prefix>-area-insight-api` | 保存 API。CPU 1 / 512Mi、`/healthz` で起動確認 |
| LB | `<prefix>-area-insight` | `/api/*` は API、それ以外はサイト。HTTP は HTTPS へ 301 |
| Cloud Armor | `-edge` / `-api` | 公開前の国制限（任意） / API のレート制限 |
| Secret Manager | 下表 | API キーなど。値は手で登録 |
| Artifact Registry | `area-insight-api` | 保存 API のイメージ（`vX.Y.Z`） |
| Monitoring | API のアラート | インスタンス数上限近く、5xx、429、p95 遅延 |

旧ドメイン `gc.maa-un.com` は同じ LB で受け、画面は `machinome.maa-un.com` へ 301。`/api/*` は転送しない（Webhook 用）。

## バッチのジョブ

`apps/batch` を Actions 上でビルドし、9種類のジョブ（取得8種類と集計）を動かす。各実行の上限は350分。地価は開始時にタイル一覧を固定し、8分割を順に取得する。全部成功した後に1回のロードで対象年を置き換える。

取得と集計の中身は [詳細設計](detailed-design/batch.md)、実行・再実行と設定は [GitHub Actions バッチ](batch-actions.md) を参照。

## 定期実行

時刻は日本時間。`batch.yml` の schedule が起動する。各回の最後に `aggregate` を実行し、画面を作り直す。

| スケジュール | 日時 | ジョブ |
|---|---|---|
| monthly | 毎月 3 日 4:00 | municipalities → transactions → station-transactions → condo-transactions → aggregate |
| land-prices | 4 月 10 日 4:00 | land-prices → aggregate |
| annual | 10 月 10 日 4:00 | statistics → projections → stations → land-prices → aggregate |

## サービスアカウントと権限

| SA | 使う部品 | 権限 |
|---|---|---|
| `batch` | GitHub Actions のバッチ | BigQuery dataEditor・jobUser、データ用バケット objectAdmin、Secret（reinfolib、e-Stat） |
| `api` | 保存 API | Firestore（datastore.user）、Secret（Clerk Webhook 署名鍵） |
| `deploy` | GitHub Actions | Artifact Registry writer、データ用バケット読み取り、サイト用バケット書き込み、CDN の無効化だけのカスタムロール |

GitHub Actions は Workload Identity 連携で入る。信頼するのは area-insight リポジトリの `main` と `vX.Y.Z` タグだけ。

## Secret Manager

| Secret（`<prefix>-area-insight-…`） | 使う SA | 環境変数 |
|---|---|---|
| `reinfolib-api-key` | batch | `REINFOLIB_API_KEY` |
| `estat-app-id` | batch | `ESTAT_APP_ID` |
| `clerk-webhook-secret` | api | `CLERK_WEBHOOK_SECRET` |

2026年10月24日に Actions の全取得・集計・画面更新を確認し、旧 Cloud Run Jobs・Workflows・Scheduler と専用リソース29件を Terraform で撤去した。`modules/` のソース、データ基盤、保存 API は保持している。

## 配信の設定

| 項目 | 値 |
|---|---|
| CDN | `CACHE_ALL_STATIC`、既定 TTL 1h、最大 1 日、stale 配信 1 日 |
| assets | `max-age=31536000, immutable`。JSON は gzip で置く |
| HTML | `max-age=300`。配置後に CDN を全パス無効化 |
| ヘッダー | HSTS、CSP、nosniff、Referrer-Policy、Permissions-Policy |
| CSP の外部許可 | Clerk、Cloudflare Turnstile、地理院タイル、OpenFreeMap |
