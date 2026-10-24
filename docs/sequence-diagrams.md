# シーケンス図

部品は [システム構成図](system-architecture.md)、リソースは [インフラ構成図](infrastructure.md) と同じ名前を使う。

## 1. データ更新

```mermaid
sequenceDiagram
  autonumber
  participant A as GitHub Actions batch.yml
  participant P as 公的 API
  participant B as BigQuery
  participant G as GCS データ用
  participant W as GitHub Actions web.yml
  participant T as GCS サイト用 / CDN

  Note over A: schedule / 手動で main のコードをビルド
  loop 地価以外の取得ジョブを1つずつ実行
    A->>P: 取得（1秒間隔、5xxは再試行）
    A->>B: ロードジョブ（WRITE_TRUNCATE）
  end
  Note over A,G: 地価は固定一覧の8分割を順に取得しGCSへ保存
  A->>B: 全分割成功後、1回のロードで対象年を置換
  A->>B: 全取得成功後に集計（CREATE OR REPLACE）
  B->>G: EXPORT DATA（export_id付き）
  A->>W: 再利用ワークフローを呼ぶ
  W->>G: exports/ を取得
  W->>W: prepare-data → build → prerender
  W->>T: assets → HTML → CDN無効化
```

取得に失敗したジョブはロードせず、その対象範囲のrawを前回のまま残す。地価も全分割が成功するまで本番テーブルを更新しない。取得が1つでも失敗すれば集計・画面更新は実行しない（それ以前に成功した別ジョブのrawは更新済み）。

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
