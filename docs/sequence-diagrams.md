# シーケンス図

部品は [システム構成図](system-architecture.md)、リソースは [インフラ構成図](infrastructure.md) と同じ名前を使う。

## 1. データ更新

```mermaid
sequenceDiagram
  autonumber
  participant S as Cloud Scheduler
  participant W as Workflows
  participant J as Cloud Run Jobs
  participant P as 公的 API
  participant B as BigQuery
  participant G as GCS データ用
  participant A as GitHub Actions
  participant T as GCS サイト用 / CDN

  S->>W: 起動（jobs = [...]）
  loop jobs の順に
    W->>J: ジョブ実行（終わるまで待つ）
    J->>P: 取得（1 秒間隔、5xx は再試行）
    J->>B: ロードジョブ（WRITE_TRUNCATE）
  end
  Note over W,J: 最後のジョブは aggregate
  J->>B: 集計テーブルを CREATE OR REPLACE
  J->>G: EXPORT DATA（export_id 付き）
  W->>A: repository_dispatch（data-updated）
  A->>G: exports/ を取得
  A->>A: prepare-data → build → prerender
  A->>T: assets を置く → HTML を置く → CDN 無効化
```

途中のジョブが失敗したら、Workflows はそこで止まる。raw も画面も前回のまま残る。

## 2. 閲覧

```mermaid
sequenceDiagram
  autonumber
  participant U as ブラウザ
  participant L as LB + CDN
  participant S as GCS サイト用

  U->>L: GET /areas/13101/
  alt キャッシュあり
    L-->>U: HTML
  else キャッシュなし
    L->>S: 取得
    S-->>L: HTML
    L-->>U: HTML
  end
  U->>L: GET /assets/*.js（immutable）
  U->>U: 埋め込みのルート JSON でハイドレーション
  opt Cookie __client_uat が 0 以外
    U->>U: Clerk を動的 import（→ 3 へ）
  end
```

詳細データは HTML に埋め込み済みなので、閲覧で API も DB も呼ばない。

## 3. ログインと保存

```mermaid
sequenceDiagram
  autonumber
  participant U as ブラウザ
  participant C as Clerk
  participant L as LB（Cloud Armor）
  participant A as 保存 API
  participant F as Firestore

  U->>C: Google でログイン（Clerk を必要時だけ読み込む）
  C-->>U: セッション
  U->>C: セッショントークン取得
  U->>L: GET /api/me（Bearer）
  L->>A: 転送（120 回/分/IP を超えたら 429）
  A->>C: JWKS 取得（キャッシュ）
  A->>A: 署名・iss・azp を検証
  A->>F: area-insight-users/{userId} を読む
  A-->>U: {favorites, compare, filters}
  opt サーバーの比較リストが空
    U->>A: PUT /api/me/compare（ブラウザの比較リストを引き継ぐ）
  end
  U->>A: PUT /api/me/favorites {favorites}
  A->>A: zod 検証 → 業務ルール（重複除去・上限）
  A->>F: set（ドキュメント全体を上書き）
  A-->>U: 更新後の UserData
```

## 4. アカウント削除

```mermaid
sequenceDiagram
  autonumber
  participant C as Clerk
  participant A as 保存 API
  participant F as Firestore

  C->>A: POST /api/webhooks/clerk（svix 署名）
  A->>A: 署名と時刻（±5 分）を検証
  alt type = user.deleted
    A->>F: area-insight-users/{userId} を削除
  else それ以外
    A->>A: 何もしない
  end
  A-->>C: 204
```

## 5. リリース

```mermaid
sequenceDiagram
  autonumber
  actor D as 開発者
  participant G as GitHub
  participant A as GitHub Actions
  participant R as Artifact Registry
  participant T as maaun-terraform
  participant C as Cloud Run

  D->>G: PR（必要なら package.json の version を上げる）
  G->>A: ci.yml（lint / typecheck / test / build / イメージのビルド確認）
  D->>G: main にマージ
  G->>A: deploy.yml（ci.yml を通してから）
  A->>A: 画面をビルドしてサイト用バケットへ
  alt vX.Y.Z タグがまだ無い
    A->>R: api / batch のイメージを push
    A->>G: タグと GitHub Release を作る
  end
  D->>T: tfvars のタグを変える PR → plan → apply
  T->>C: 新しいイメージで稼働
```

CI から Cloud Run を直接更新しない。
