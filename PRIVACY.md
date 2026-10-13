# Privacy Policy / プライバシーポリシー

_Last updated: 2026-10-13_

## English

Drive HTML Preview ("the extension") renders HTML files stored in Google Drive as web pages.

- **What it reads.** When you click “Preview as web page”, the toolbar button or the right-click menu item, the extension downloads that one file from Google Drive (`drive.google.com` / `drive.usercontent.google.com`) using your browser's existing Google sign-in. On Drive pages it reads the file name and file ID shown on screen to know which file to open.
- **What it does with it.** The file is decoded and displayed in a sandboxed page inside your browser. Nothing is stored after you close the tab.
- **What it sends.** Nothing. The extension has no server, no analytics, no ads and no third-party SDKs. It never sends your files, file names, account details or browsing activity to the developer or anyone else.
- **Pages you preview.** The previewed HTML runs in an isolated sandbox. If that HTML itself loads images, scripts or fonts from the internet, those requests are made by the page you chose to open, exactly as if you had opened it in a browser.
- **Permissions.** `drive.google.com` and `drive.usercontent.google.com` host access is used only to download the file you asked to preview and to show the preview button on Drive. `contextMenus` adds the right-click menu item for Drive links.

The extension's use of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

Contact: open an issue at https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/issues

## 日本語

Drive HTML Preview（以下「本拡張機能」）は、Google ドライブに保存された HTML ファイルを Web ページとして表示する Chrome 拡張機能です。

- **読み取る情報**：「Web ページとして表示」ボタン、ツールバーのボタン、右クリックメニューを押したときに、その 1 ファイルだけを、ブラウザに既にある Google のログイン状態を使って Google ドライブ（`drive.google.com` / `drive.usercontent.google.com`）からダウンロードします。Drive の画面では、どのファイルを開くか判断するために、画面に表示されているファイル名とファイル ID を読み取ります。
- **使い方**：ファイルはブラウザ内のサンドボックス化されたページで表示するだけです。タブを閉じると何も残りません。
- **送信する情報**：ありません。本拡張機能には独自サーバー・アクセス解析・広告・外部 SDK は一切なく、ファイル・ファイル名・アカウント情報・閲覧履歴を開発者や第三者に送ることはありません。
- **表示するページについて**：プレビューする HTML は隔離されたサンドボックスで動作します。その HTML 自体がインターネット上の画像・スクリプト・フォントを読み込む場合、その通信は通常のブラウザで開いたときと同じように、そのページが行います。
- **権限**：`drive.google.com` と `drive.usercontent.google.com` へのアクセスは、指定したファイルのダウンロードと Drive 上へのボタン表示のためだけに使います。`contextMenus` は Drive のリンクを右クリックしたときのメニューのために使います。

本拡張機能の情報の利用は、Chrome ウェブストアのユーザーデータに関するポリシー（Limited Use の要件を含む）に準拠しています。

お問い合わせ：https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/issues
