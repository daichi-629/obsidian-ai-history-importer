# Obsidian AI History Importer

ChatGPT エクスポート履歴 (`conversations.json`) を Obsidian Vault に Markdown と添付ファイルとして取り込むプラグインです。

## 構成

このリポジトリは 3 層のモノレポ構成です。

- `packages/core`
  - Obsidian 非依存。
  - 会話データモデルと Nunjucks ベースの Markdown レンダリングを提供。
- `packages/chatgpt`
  - Obsidian 非依存。
  - ChatGPT `conversations.json` を `core` の汎用会話モデルへ変換。
  - `current_node` から採用分岐を選択し、重複会話 ID を除外。
- `packages/plugin`
  - Obsidian プラグイン。
  - 設定 UI、インポート実行、添付ファイルコピー、重複インポート回避を担当。

## 主な機能

- `example-history` 形式の ChatGPT export 取り込み
- 1 会話 = 1 Markdown ファイル
- 添付ファイルの Vault 内コピーと Obsidian リンク埋め込み
  - 画像 MIME は `![[...]]`
  - その他は `[[...]]`
- 重複取り込み防止
  - `chatgpt:<conversation-id>` を import key として管理
  - 取り込み済み会話は更新時刻比較でスキップ/更新
- Nunjucks テンプレート対応
  - 設定でカスタムテンプレートファイルを指定可能

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm run dev --filter plugin
```

## ビルド

```bash
pnpm run build
```

## テスト

```bash
pnpm run test
```

## Lint

```bash
pnpm run lint
```

## プラグインの使い方

1. Obsidian でプラグインを有効化
2. 設定画面で以下を指定
   - `Export directory`: ChatGPT export ディレクトリ
   - `Notes directory`: 会話 Markdown の保存先（Vault 内）
   - `Attachments directory`: 添付ファイル保存先（Vault 内）
   - 任意で `Custom template path`
3. コマンドパレットから `Import chat history` を実行

## 取り込み対象

- 対象: `conversations.json`
- 非対象: `sora.json`, `shopping.json` など

## 出力形式（デフォルト）

`core` のデフォルト Nunjucks テンプレートで、以下を出力します。

- Frontmatter
  - `ai_source`
  - `ai_conversation_id`
  - `ai_import_key`
  - `created_at`, `updated_at`
- 本文
  - 見出し: 会話タイトル
  - 各メッセージを role 単位で列挙
  - 添付リンク
