# 来日公演ウォッチ

海外アーティストの日本公演を複数の公演情報サイトから収集し、月別に確認する静的Webアプリです。

## MVP仕様

- アーティスト名、公演日、会場、都道府県、出典、出典URL、初回検出日、一般発売日、先行情報を表示
- 初回検出から7日以内の公演に `NEW` を表示
- アーティスト名・都道府県・情報元で絞り込み
- 同一公演を「正規化アーティスト名 + 公演日 + 正規化会場名」で統合
- 取得元ごとの原文とURLを残し、誤統合時に追跡可能にする
- ユーザー登録やメール通知などのユーザー管理機能は持たない
- お気に入りは端末内のlocalStorageだけに保存する
- ユーザーが明示的に許可した場合、アプリを開いた際にお気に入りの新着をブラウザ通知する

## 無料で運用する構成

```text
公式サイト / 無料RSS・API
        ↓ 1日1回（GitHub Actions）
Node.js収集スクリプト
        ↓ 正規化・重複統合
public/data/concerts.json
        ↓
React + Vite 静的サイト（GitHub PagesまたはVercel無料枠）
```

- 有料API、Supabase、Resend、外部DB、サーバーレスAPIは使用しない
- 公式の無料RSS/APIが利用可能な場合はHTML取得より優先できるアダプター構成
- GitHub ActionsとGitHub Pagesだけで運用可能
- Vercelを使う場合も静的ファイル配信のみとし、無料枠超過を前提とする処理は置かない
- 収集失敗時は直前のJSONを維持し、サイト表示を止めない

無料枠や提供条件は将来変更される可能性があるため、利用サービスの条件は運用者が定期的に確認してください。本アプリ自身が従量課金APIを呼び出すことはありません。

## セキュリティ方針

- APIキーや認証情報を必要としない
- お気に入り情報は外部送信せず、利用中のブラウザ内だけに保存
- 取得先は `scripts/sources.mjs` のHTTPS許可ホストに限定
- リダイレクト先も毎回検証し、未知ホストへのアクセスを拒否
- `robots.txt` を確認し、拒否されたURLは取得しない
- タイムアウト、最大レスポンスサイズ、ソース別・全体の日次上限を設定
- HTMLはデータとして解析し、画面にHTMLとして挿入しない（Reactの文字列エスケープを利用）
- 出典リンクはHTTPS URLだけを許可し、`noopener noreferrer` を付与
- GitHub Actionsの権限は `contents: write` のみに限定
- 依存パッケージを最小限にし、Dependabot設定を含める

## 初期取得対象（8ソース）

1. UDO音楽事務所
2. Creativeman
3. SMASH
4. Live Nation Japan / H.I.P.
5. キョードー東京
6. Billboard Live
7. uDiscoverMusic Japan（横断確認用）
8. CLUB QUATTRO

各サイトの利用規約、robots.txt、HTML構造は変わり得ます。取得不可または不安定なソースは回避せず停止し、`sourceStatus` に理由を記録します。

## データ設計

`public/data/concerts.json` に以下を保存します。

- `concerts`: 統合済み公演
  - `id`, `artistName`, `title`, `performanceDate`, `startTime`
  - `venueName`, `prefecture`, `status`
  - `generalSaleAt`, `presaleInfo`
  - `firstDetectedAt`, `lastSeenAt`, `sources`
- `sourceStatus`: ソース別の最終実行状態、取得件数、案内メッセージ
- `generatedAt`: データ生成日時

過去JSONと比較して `firstDetectedAt` を維持します。将来の追加公演・日程変更・会場変更・中止検知に備え、各取得元のコンテンツハッシュと最終確認日時を保持します。

## 重複判定

1. 同じ出典URLは同一レコード
2. 正規化したアーティスト名・公演日・会場名が一致すれば統合
3. 同日2ステージや複数出演フェスは、開始時刻・公演タイトルが異なる場合は分離
4. 曖昧なファジーマッチは自動統合しない

正規化ではUnicode NFKC、英字小文字化、空白・記号の統一、会場の既知別名辞書を使います。

## リポジトリ構成

```text
├─ .github/workflows/collect.yml     # 毎日の定期収集
├─ public/data/concerts.json         # フロントが読む静的データ
├─ scripts/
│  ├─ collect.mjs                    # 収集オーケストレーター
│  ├─ fetch-safe.mjs                 # robots、許可ホスト、Quota、キャッシュ
│  ├─ normalize.mjs                  # 正規化・重複統合
│  ├─ parse.mjs                      # JSON-LD・日本語公演表記の解析
│  └─ sources.mjs                    # ソースアダプター設定
├─ src/components/ui/                # shadcn/ui方針のUI部品
├─ src/App.tsx                       # 月別公演一覧
└─ tests/                            # 解析・重複判定テスト
```

## ローカル実行

```bash
npm install
npm run collect
npm test
npm run dev
```

収集せず画面だけ確認する場合は `npm run dev` で起動できます。初期JSONが空の場合は案内画面を表示します。

## 公開と自動更新

GitHubリポジトリへ配置し、Settings > Pages のSourceを「GitHub Actions」にすると、`main` ブランチ更新時に静的サイトが公開されます。毎日06:17（日本時間）の収集後、データに変更があれば自動で再公開されます。外部DBやAPIキーは不要です。

GitHub ActionsやPagesの無料提供条件・利用上限はGitHub側で変更される可能性があります。課金設定を追加せず、利用状況をGitHubのBilling画面で確認してください。

## 環境変数（任意）

| 変数 | 既定値 | 用途 |
|---|---:|---|
| `COLLECT_MAX_TOTAL` | `80` | 1回の総HTTP取得上限 |
| `COLLECT_MAX_PER_SOURCE` | `15` | ソース別取得上限 |
| `COLLECT_CACHE_HOURS` | `24` | HTTPキャッシュ時間 |
| `COLLECT_TIMEOUT_MS` | `15000` | 1リクエストのタイムアウト |

秘密情報はありません。`.env` は念のためGit管理対象外です。

## お気に入りと通知の制約

お気に入りと通知はアカウントなしで利用できます。ただし、保存先はブラウザ内だけなので端末間同期はされません。通知判定はページを開いたときに行われ、ブラウザを閉じた状態でのバックグラウンド通知やメール通知は行いません。通知権限の要求は「通知を有効化」ボタンを押したときだけ実行します。
