# Obsidian AI History Importer

ChatGPT / Claude のエクスポートを、Obsidian のノートとして取り込むプラグインです。会話ごとに 1 つの Markdown ファイルを作成し、添付ファイルも一緒に保存します。

## できること

- ChatGPT / Claude の `conversations.json` を取り込み
- 会話ごとに 1 つのノートを作成
- 添付ファイルを Vault に保存してリンクを自動挿入
- 取り込み済みの会話は重複作成せず、必要なら上書き
- テンプレートでノートの見た目をカスタマイズ

## 使い方

1. ChatGPT または Claude からエクスポートしたフォルダを用意します（中に `conversations.json` があるフォルダ）。
2. Obsidian の **設定 → コミュニティプラグイン** で本プラグインを有効化します。
3. 設定画面で以下を指定します。
   - **Export directory**: エクスポートしたフォルダのパス
   - **ChatGPT notes directory**: ChatGPT ノートの保存先（Vault 内）
   - **Claude notes directory**: Claude ノートの保存先（Vault 内）
   - **Attachments directory**: 添付ファイルの保存先（Vault 内）
   - **Custom template path**（任意）: テンプレートファイルのパス
4. コマンドパレットで **Import ChatGPT history** または **Import Claude history** を実行します。

## 取り込み対象

- 対象: `conversations.json`
- 対象外: `sora.json`, `shopping.json` など

## よくある質問

### 取り込み済みの会話はどうなりますか？
- **Overwrite on reimport** がオフ: 既存ノートはスキップされます。
- **Overwrite on reimport** がオン: 既存ノートを上書きします。

### 添付ファイルはどこに保存されますか？
設定した **Attachments directory** に保存されます。画像は `![[...]]`、その他は `[[...]]` のリンクでノートに挿入されます。
Claude のエクスポートには添付ファイルが含まれないため、Claude 取り込みでは添付ファイルは作成されません。

## テンプレート

テンプレートを使うと、ノートの構成を自由に変更できます。**Custom template path** は Vault からの相対パスで指定してください（例: `Templates/chatgpt.md`）。テンプレートは Nunjucks 形式です。

### デフォルトテンプレートの内容

デフォルトでは以下の内容が出力されます。

- Frontmatter: `ai_source`, `ai_conversation_id`, `ai_import_key`, `created_at`, `updated_at`
- 見出し: 会話タイトル
- 各メッセージをロールごとに見出し化して本文を出力
- 添付ファイルがあれば `Attachments` セクションにリンクを列挙

### カスタムテンプレートの書き方

テンプレートでは `conversation` とその中の `messages` / `attachments` を参照できます。

主なフィールド:
- `conversation.source`
- `conversation.conversationId`
- `conversation.importKey`
- `conversation.title`
- `conversation.createdAt`, `conversation.updatedAt`
- `conversation.messages`（配列）
  - `message.role`, `message.createdAt`, `message.content`, `message.contentType`
  - `message.attachments`（配列）
    - `attachment.id`, `attachment.name`, `attachment.mimeType`
    - `attachment.sizeBytes`, `attachment.vaultPath`, `attachment.obsidianLink`

利用できるフィルタ:
- `roleTitle`（例: `{{ message.role | roleTitle }}`）

最小テンプレート例:

```nunjucks
---
ai_source: "{{ conversation.source }}"
ai_conversation_id: "{{ conversation.conversationId }}"
---

# {{ conversation.title }}

{% for message in conversation.messages %}
## {{ message.role | roleTitle }}

{{ message.content | trim }}
{% endfor %}
```

## 注意点

- エクスポートフォルダには `conversations.json` が必要です。
- 大量の履歴を取り込む場合、処理に時間がかかることがあります。
