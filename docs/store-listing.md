# Chrome Web Store listing

Everything the Chrome Web Store developer dashboard asks for, ready to paste.
Package: `npm run build` → `dist/drive-html-preview-<version>.zip`.

## Store listing

| Field | Value |
|---|---|
| Category | Tools (ツール) |
| Language | Japanese (default, from `default_locale`), English |
| Store icon | `src/icons/icon-128.png` |
| Screenshots (1280×800) | `docs/images/store/<lang>/1-before-after.png`, `2-in-place.png`, `3-source.png`, `4-privacy.png` |
| Small promo tile (440×280) | `docs/images/store/<lang>/promo-small.png` |
| Marquee promo tile (1400×560) | `docs/images/store/<lang>/promo-marquee.png` |
| Homepage URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview |
| Support URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/issues |
| Privacy policy URL | https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/blob/main/PRIVACY.md |

### Description (日本語)

```
Google ドライブで HTML ファイルをプレビューすると、ページではなくタグだらけのソースが表示されます。いちいちダウンロードしてデスクトップで開き直していませんか？ Drive HTML Preview を入れると、Drive のプレビューがそのまま本来の Web ページとして表示されます。

■ できること
・Drive で .html ファイルをダブルクリックするだけ。プレビューの中に、描画されたページがそのまま表示されます
・フォルダ、検索結果、共有ドライブのプレビューと、ファイルページ（drive.google.com/file/d/…）に対応。Drive の矢印で次のファイルに移っても追従します
・右上のスイッチで、ページとソースをワンクリックで切り替え。新しいタブでの全画面表示もできます
・JavaScript もそのまま動きます。CDN から読み込むライブラリも使えます
・文字コードを自動判別（UTF-8、Shift_JIS、EUC-JP など）
・共有されたファイル、複数アカウントのログインにも対応

■ プライバシー
・ファイルはあなたのブラウザが、あなたのログイン状態で Google ドライブから直接読み込みます
・独自サーバー、アクセス解析、広告、アカウント連携は一切ありません
・HTML は拡張機能から隔離されたサンドボックスで表示され、Drive やほかのタブには触れられません

■ 制限
・Drive 上の別ファイルへの相対パス（CSS や画像）は読み込めません
・50 MB を超えるファイルは表示しません

オープンソース（MIT ライセンス）：https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview
```

### Description (English)

```
Google Drive previews HTML files as raw source code, so you end up downloading each one and opening it on your desktop. With Drive HTML Preview, Drive's own preview shows the real web page instead.

WHAT IT DOES
• Just double-click an .html file in Google Drive. The rendered page appears right inside the preview.
• Works in folders, search results, shared drives and on file pages (drive.google.com/file/d/…), and follows Drive's next / previous arrows.
• A small switch flips between the page and its source, or opens it in a full tab.
• JavaScript runs, including libraries loaded from a CDN.
• Detects the character encoding automatically (UTF-8, Shift_JIS, EUC-JP and more).
• Works with files shared with you and with multiple signed-in accounts.

PRIVACY
• Your browser downloads the file straight from Google Drive with your own sign-in.
• No servers, no analytics, no ads, no account linking.
• The HTML runs in a sandbox isolated from the extension, from Drive and from your other tabs.

LIMITATIONS
• Relative paths to other Drive files (CSS, images) can't be loaded.
• Files over 50 MB aren't previewed.

Open source (MIT): https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview
```

## Privacy practices

### Single purpose

```
Google ドライブのプレビューで、HTML ファイルをソースコードではなく Web ページとして表示すること。
Show HTML files in Google Drive's preview as rendered web pages instead of raw source code.
```

### Permission justifications

**Host permissions (https://drive.google.com/\*, https://drive.usercontent.google.com/\*)**

```
drive.google.com：Drive のプレビューで開かれている HTML ファイルを特定し、その上に描画したページを重ねて表示するため、およびそのファイルをダウンロードするため（/uc?export=download）。
drive.usercontent.google.com：Drive のダウンロードは必ずこのホストへリダイレクトされるため、ファイル本体の取得に必要です。
どちらもユーザーがプレビューしているファイルだけを対象にし、内容はブラウザ内で表示するだけで外部に送信しません。

drive.google.com: to detect the HTML file open in Drive's preview, show the rendered page over it, and download that file (/uc?export=download).
drive.usercontent.google.com: Drive redirects every download to this host, so it is needed to receive the file contents.
Only the file the user is previewing is fetched; its contents are displayed locally and never sent anywhere.
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
