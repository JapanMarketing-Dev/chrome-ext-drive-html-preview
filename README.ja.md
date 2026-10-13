<div align="center">

<img src="docs/images/icon-256.png" width="96" height="96" alt="Drive HTML Preview のアイコン">

# Drive HTML Preview

**Google ドライブのプレビューで、HTML ファイルがソースではなく本来の Web ページとして表示される Chrome 拡張機能。**<br>
Drive で `.html` をダブルクリックするだけで、その場にページが表示されます。スクリプトも動き、文字コードも自動判別。データはどこにも送りません。

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Drive%20HTML%20Preview-e34f26?style=flat&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/search/Drive%20HTML%20Preview)
[![Release](https://img.shields.io/github/v/release/JapanMarketing-Dev/chrome-ext-drive-html-preview?style=flat&color=f06529&label=release)](https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-ff8a65?style=flat)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4b5563?style=flat)](src/manifest.json)
[![Privacy](https://img.shields.io/badge/data%20collected-none-3ee08f?style=flat)](PRIVACY.md)

[インストール](#インストール) · [しくみ](#しくみ) · [プライバシー](PRIVACY.md) · [開発](#開発)

[English](README.md) · **日本語**

<br>

<img src="docs/images/social-preview.png" width="100%" alt="Drive HTML Preview：Google ドライブの HTML ファイルを売上レポートの Web ページとして表示した画面">

</div>

<br>

## Drive は HTML を文字で見せる。これはページで見せる。

Google ドライブで `.html` をプレビューすると、表示されるのはタグの羅列です。ツールから書き出したレポート、試作画面、メールマガジン、AI が作ったページ……これまでは、ひとつずつダウンロードしてデスクトップで開くしかありませんでした（Slack ではプレビューできるのに、Drive ではできない）。

Drive HTML Preview を入れると、Drive のプレビューがそのままページになります。ボタンを押す必要もありません。

<img src="docs/images/store/ja/1-before-after.png" width="100%" alt="変更前：Drive のプレビューは HTML のソースを表示。変更後：同じプレビューにページが表示される。">

## ダブルクリックするだけ。ダウンロード不要。

Drive がファイルをプレビューする場所ならどこでも動きます。フォルダでダブルクリックしたときのプレビュー、検索結果、共有ドライブ、ファイルページ（`drive.google.com/file/d/…`）。Drive の矢印で次のファイルに移ると、表示も切り替わります。

右上の小さなスイッチで、ページとソースの切り替えや、新しいタブでの全画面表示ができます。ツールバーのアイコンからも、今のファイルを新しいタブで開いたり、Drive のリンクを貼り付けて開いたりできます。

<img src="docs/images/store/ja/2-in-place.png" width="100%" alt="Drive のプレビューに HTML のレポートがそのまま表示されている画面">

## ページとコードをワンクリックで切り替え

表示中のページとソースをすぐ切り替えられます。文字コードはブラウザと同じ順序（BOM → `Content-Type` → `<meta charset>`）で判定し、Shift_JIS・EUC-JP などの古い文字コードも自動で扱います。

<img src="docs/images/store/ja/3-source.png" width="100%" alt="プレビューとソースのタブがあるビューア">

## ファイルはどこにも送りません

<img src="docs/images/store/ja/4-privacy.png" width="100%" alt="サンドボックス表示、外部送信ゼロ、最小限の権限">

| | |
|---|---|
| **サンドボックス表示**　HTML は拡張機能から隔離された、オリジンを持たないサンドボックスで動きます。拡張機能・Drive のログイン状態・ほかのタブには触れられません。 | **サーバーなし**　ファイルはあなたのブラウザが、あなたのログイン状態で Drive から直接読み込みます。解析・広告・アカウント連携はありません。 |
| **最小限の権限**　必要なのは `drive.google.com` / `drive.usercontent.google.com` へのアクセスだけです。 | **開けるものはそのまま開ける**　共有ドライブ、共有されたファイル、複数アカウントのログイン（`/u/1/`）、リソースキー付きのリンクにも対応。 |

## インストール

**Chrome ウェブストア：** [Drive HTML Preview](https://chromewebstore.google.com/search/Drive%20HTML%20Preview) を開き「Chrome に追加」を押します。

**ソースから：**

1. [Releases](https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/releases) から `drive-html-preview-<version>.zip` をダウンロードして展開します（またはこのリポジトリを clone）。
2. `chrome://extensions` を開き、**デベロッパー モード** をオンにします。
3. **パッケージ化されていない拡張機能を読み込む** を押し、展開したフォルダ（clone した場合は `src/`）を選びます。

## しくみ

```
Drive のプレビュー ──(ファイル ID と名前)──▶ content script ──▶ Drive の紙面の上にフレームを重ねる
                                                                  │  viewer.html?embed=1
            drive.google.com/uc?export=download&id=…  ◀───────────┤  あなたのログインで取得
            （取得できないときは Drive が表示している本文を使う）     │
                                   サンドボックス iframe ◀── 文字コード変換後の HTML
```

- `src/content.js` が画面上の HTML ファイルを特定し（ファイルページでは URL から、プレビューでは表示中のファイル名と開いた一覧の項目を照合）、Drive がソースを表示している紙面の上にフレームを重ねます。
- `src/viewer.js` がファイルをダウンロードし、文字コードを判定して（`src/lib/html.js`）、オリジンを持たないサンドボックスページ `src/sandbox.html` に渡します。ダウンロードできないときは、Drive が画面に表示している本文を使います。
- 外部サイトへのリンクは新しいタブで開きます。Drive の別ファイルを指す相対リンクや画像は、Drive のファイルごとに ID が違うため解決できません。

### 制限

- Drive 上の別ファイルへの相対パス（`./style.css`、`images/a.png` など）は読み込めません。インライン化するか、絶対 URL を使ってください。
- 50 MB を超えるファイルは表示しません。
- オーナーが閲覧者のダウンロードを禁止している場合は、Drive が表示している本文で描画します（非常に長いファイルは Drive 側で途中までしか表示されないことがあります）。

## 開発

```bash
npm install
npm test                 # 単体テスト（node:test + jsdom）
npm run test:integration # Chromium に拡張機能を読み込んで全体の流れを確認
npm run build            # dist/drive-html-preview-<version>.zip を作成
npm run assets           # アイコンとストア画像を再生成
```

`npm run assets` で使うスクリーンショットを更新するときは、結合テストを `SHOTS_DIR=docs/images/shots/ja UI_LANG=ja` 付きで実行します。

## ライセンス

[MIT](LICENSE) © 2026 JapanMarketing-Dev
