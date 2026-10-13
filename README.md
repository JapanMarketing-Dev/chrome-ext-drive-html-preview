<div align="center">

<img src="docs/images/icon-256.png" width="96" height="96" alt="Drive HTML Preview icon">

# Drive HTML Preview

**Open HTML files stored in Google Drive as real web pages, not raw source.**<br>
One button on Drive, a new tab with the rendered page. Scripts run, encodings are detected, nothing leaves your browser.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Drive%20HTML%20Preview-e34f26?style=flat&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/search/Drive%20HTML%20Preview)
[![Release](https://img.shields.io/github/v/release/JapanMarketing-Dev/chrome-ext-drive-html-preview?style=flat&color=f06529&label=release)](https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-ff8a65?style=flat)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-4b5563?style=flat)](src/manifest.json)
[![Privacy](https://img.shields.io/badge/data%20collected-none-3ee08f?style=flat)](PRIVACY.md)

[Install](#install) · [How it works](#how-it-works) · [Privacy](PRIVACY.md) · [Development](#development)

**English** · [日本語](README.ja.md)

<br>

<img src="docs/images/social-preview.png" width="100%" alt="Drive HTML Preview: a Google Drive HTML file rendered as a sales report web page.">

</div>

<br>

## Drive shows your HTML as text. This shows it as a page.

Open an `.html` file in Google Drive and you get a wall of tags. Reports exported from tools, prototypes, newsletters, AI-generated pages: all of them are unreadable until you download and open them locally.

With Drive HTML Preview installed, a **Preview as web page** button appears whenever an HTML file is open in Drive. Click it and the page opens, fully rendered, in the next tab.

<img src="docs/images/store/en/1-before-after.png" width="100%" alt="Before: Drive shows HTML source. After: the same file rendered as a web page.">

## One button, right where you open the file

The button shows up on Drive's preview overlay (when you double-click a file in a folder) and on file pages (`drive.google.com/file/d/…`). You can also:

- click the extension's **toolbar icon** while a Drive HTML file is open,
- **right-click any Drive file link** (in Gmail, Slack, docs…) and choose *Preview Drive HTML as a web page*, or
- open the toolbar icon anywhere and **paste a Drive link**.

<img src="docs/images/store/en/2-button.png" width="100%" alt="A Preview as web page button at the bottom right of a file showing HTML source.">

## Page or code, one click apart

Switch between the rendered page and its source. Character encodings are picked like a browser would (BOM, `Content-Type`, `<meta charset>`), with Shift_JIS / EUC-JP and other legacy encodings handled automatically.

<img src="docs/images/store/en/3-source.png" width="100%" alt="The viewer with Preview and Source tabs.">

## Your files stay with you

<img src="docs/images/store/en/4-privacy.png" width="100%" alt="Sandboxed, nothing sent anywhere, minimal permissions.">

| | |
|---|---|
| **Sandboxed.** The HTML runs in an isolated, opaque-origin sandbox. It can't touch the extension, your Drive session or your other tabs. | **No servers.** Your browser downloads the file straight from Drive with your own sign-in. No analytics, no ads, no account linking. |
| **Minimal permissions.** Access to `drive.google.com` / `drive.usercontent.google.com` and one right-click menu item. | **Works with what you can already open.** Shared drives, shared files, multiple signed-in accounts (`/u/1/`), resource-key links. |

## Install

**Chrome Web Store:** search for [Drive HTML Preview](https://chromewebstore.google.com/search/Drive%20HTML%20Preview) and click *Add to Chrome*.

**From source:**

1. Download `drive-html-preview-<version>.zip` from [Releases](https://github.com/JapanMarketing-Dev/chrome-ext-drive-html-preview/releases) and unzip it (or clone this repository).
2. Open `chrome://extensions`, turn on **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder (or `src/` in the clone).

## How it works

```
Drive page ──(file ID + name)──▶ content script ──▶ service worker ──▶ viewer tab
                                                                         │
                         drive.google.com/uc?export=download&id=…  ◀─────┘  fetch with your session
                                                                         │
                                         sandboxed iframe ◀── decoded HTML ┘
```

- `src/content.js` finds the HTML file on screen: from the URL on file pages, or by matching the overlay's file name to the list item you opened.
- `src/viewer.js` downloads the file, detects its encoding (`src/lib/html.js`) and hands the text to `src/sandbox.html`, a manifest sandbox page with an opaque origin.
- Links to other sites open in a new tab. Relative links and images that point at sibling files in Drive can't be resolved, because each Drive file has its own ID.

### Limitations

- Relative paths (`./style.css`, `images/a.png`) to other Drive files don't load. Inline them, or use absolute URLs.
- Files over 50 MB aren't previewed.
- If the owner turned off downloading for viewers, Drive won't hand the file to the extension either.

## Development

```bash
npm install
npm test                 # unit tests (node:test + jsdom)
npm run test:integration # loads the extension in Chromium and checks the whole flow
npm run build            # dist/drive-html-preview-<version>.zip
npm run assets           # re-render icons and store images
```

Set `SHOTS_DIR=docs/images/shots/en UI_LANG=en` for the integration run to refresh the screenshots used by `npm run assets`.

## License

[MIT](LICENSE) © 2026 JapanMarketing-Dev
