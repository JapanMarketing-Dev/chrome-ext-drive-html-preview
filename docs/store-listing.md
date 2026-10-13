# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, ready to paste.
Package: `npm run build` → `dist/drive-html-preview-<version>.zip`.

## Store listing

| Field | Value |
|---|---|
| Category | Tools (ツール) |
| Language | Japanese (default), English |
| Store icon | `src/icons/icon-128.png` |
| Screenshots (1280×800) | `docs/images/store/<lang>/1-before-after.png`, `2-button.png`, `3-source.png`, `4-privacy.png` |
| Small promo tile (440×280) | `docs/images/store/<lang>/promo-small.png` |
| Marquee promo tile (1400×560) | `docs/images/store/<lang>/promo-marquee.png` |
| Homepage URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview |
| Support URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/issues |
| Privacy policy URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/blob/main/PRIVACY.md |

### Description (日本語)

```
Google ドライブで HTML ファイルを開くと、ページではなくタグだらけのソースが表示されます。Drive HTML Preview は、その HTML をワンクリックで本来の Web ページとして表示する拡張機能です。

■ できること
・Drive で HTML ファイルを開くと「Web ページとして表示」ボタンが出ます。押すと隣のタブにページが表示されます
・フォルダでのプレビュー（ダブルクリック）と、ファイルページ（drive.google.com/file/d/…）の両方に対応
・ツールバーのアイコン、Drive リンクの右クリックメニュー、リンクの貼り付けからも開けます
・JavaScript もそのまま動きます。CDN から読み込むライブラリも使えます
・プレビューとソースをワンクリックで切り替え
・文字コードを自動判別（UTF-8、Shift_JIS、EUC-JP など）
・共有ドライブ、共有されたファイル、複数アカウントのログインに対応

■ プライバシー
・ファイルはあなたのブラウザが、あなたのログイン状態で Google ドライブから直接読み込みます
・独自サーバー、アクセス解析、広告、アカウント連携は一切ありません
・HTML は拡張機能から隔離されたサンドボックスで表示され、Drive やほかのタブには触れられません

■ 制限
・Drive 上の別ファイルへの相対パス（CSS や画像）は読み込めません
・50 MB を超えるファイルは表示しません
・オーナーがダウンロードを禁止しているファイルは表示できません

オープンソース（MIT ライセンス）：https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview
```

### Description (English)

```
Google Drive shows HTML files as raw source code. Drive HTML Preview opens them as the real web page in one click.

WHAT IT DOES
• Open an HTML file in Google Drive and a “Preview as web page” button appears. Click it and the rendered page opens in the next tab.
• Works on Drive's preview overlay (double-click a file in a folder) and on file pages (drive.google.com/file/d/…).
• Also opens from the toolbar icon, from the right-click menu on any Drive file link, or by pasting a Drive link.
• JavaScript runs, including libraries loaded from a CDN.
• Switch between the rendered page and its source.
• Detects the character encoding automatically (UTF-8, Shift_JIS, EUC-JP and more).
• Works with shared drives, files shared with you, and multiple signed-in accounts.

PRIVACY
• Your browser downloads the file straight from Google Drive with your own sign-in.
• No servers, no analytics, no ads, no account linking.
• The HTML runs in a sandbox isolated from the extension, from Drive and from your other tabs.

LIMITATIONS
• Relative paths to other Drive files (CSS, images) can't be loaded.
• Files over 50 MB aren't previewed.
• Files whose owner turned off downloading can't be previewed.

Open source (MIT): https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview
```

## Privacy practices

### Single purpose

```
Google ドライブに保存された HTML ファイルを、ソースコードではなく Web ページとして表示すること。
Display HTML files stored in Google Drive as rendered web pages instead of raw source code.
```

### Permission justifications

**contextMenus**

```
Drive のファイルリンクを右クリックしたときに「Drive の HTML を Web ページとしてプレビュー」メニューを追加するためだけに使います。
Adds a single "Preview Drive HTML as a web page" item to the right-click menu on Google Drive file links.
```

**Host permissions (https://drive.google.com/\*, https://drive.usercontent.google.com/\*)**

```
drive.google.com：Drive の画面で開いている HTML ファイルを特定し「Web ページとして表示」ボタンを出すため、およびユーザーが表示を選んだファイルをダウンロードするため（/uc?export=download）。
drive.usercontent.google.com：Drive のダウンロードは必ずこのホストへリダイレクトされるため、ファイル本体の取得に必要です。
どちらもユーザーが操作したファイルだけを対象にし、内容はブラウザ内で表示するだけで外部に送信しません。

drive.google.com: to detect the HTML file open on Drive, show the "Preview as web page" button, and download the file the user chose to preview (/uc?export=download).
drive.usercontent.google.com: Drive redirects every download to this host, so it is needed to receive the file contents.
Only the file the user acts on is fetched; its contents are displayed locally and never sent anywhere.
```

**Remote code**

```
いいえ（No）。拡張機能のコードはすべてパッケージに含まれています。ユーザーが選んだ HTML ファイル（ユーザーのデータ）は、拡張機能 API にアクセスできないマニフェストのサンドボックスページ内で表示され、そのページ自身が読み込むスクリプトもそのサンドボックス内でのみ動作します。
No. All extension code ships in the package. The HTML file the user chooses (user content) is rendered inside a manifest sandbox page with an opaque origin and no access to extension APIs; any scripts that page loads run only inside that sandbox.
```

### Data usage

- Collected data types: **none** (leave every box unchecked). The file is downloaded and shown locally only; nothing is transmitted to the developer or third parties.
- Certify all three disclosures:
  - I do not sell or transfer user data to third parties, outside of the approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for lending purposes

## Distribution

- Visibility: **Public**
- Regions: all regions
- Pricing: free
