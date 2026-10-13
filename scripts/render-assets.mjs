// Renders the icons, Chrome Web Store images and README images from assets/ and the
// viewer screenshots in docs/images/shots/<lang>/ (taken by the integration test with
// SHOTS_DIR set).
// Usage: node scripts/render-assets.mjs [icons|store|all]
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const what = process.argv[2] || 'all';

const dataUrl = async (path, type) => `data:${type};base64,` + (await readFile(join(root, path))).toString('base64');

async function shoot(page, html, width, height, out, transparent = true) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  console.log('wrote', out.replace(root + '/', ''));
}

async function icons(page) {
  const big = await dataUrl('assets/icon.svg', 'image/svg+xml');
  const small = await dataUrl('assets/icon-small.svg', 'image/svg+xml');
  for (const size of [16, 32]) {
    await shoot(page, `<img src="${small}" width="${size}" height="${size}" style="display:block">`, size, size, join(root, 'src/icons', `icon-${size}.png`));
  }
  await shoot(page, `<img src="${big}" width="48" height="48" style="display:block">`, 48, 48, join(root, 'src/icons/icon-48.png'));
  // Store guideline: about 96px of artwork inside a 128px canvas.
  await shoot(page, `<img src="${big}" width="108" height="108" style="display:block;margin:10px">`, 128, 128, join(root, 'src/icons/icon-128.png'));
  await shoot(page, `<img src="${big}" width="256" height="256" style="display:block">`, 256, 256, join(root, 'docs/images/icon-256.png'));
}

const COPY = {
  ja: {
    s1: ['Drive の HTML を、<br>ソースではなくページで。', 'Google ドライブで開くと文字だらけの HTML ファイルを、ワンクリックで本来の Web ページとして表示します。'],
    s2: ['HTML を開くと、<br>ボタンがひとつ<br>増えるだけ。', 'Drive のプレビューやファイル画面に「Web ページとして表示」ボタンが出ます。押すと隣のタブに表示。'],
    s3: ['見た目もコードも、<br>すぐ切り替え。', 'プレビューとソースをワンクリックで切り替え。Shift_JIS などの文字コードも自動で判別します。'],
    s4: ['ファイルはどこにも<br>送りません。', 'あなたのブラウザが Drive から直接読み込み、サンドボックス内で表示します。外部サーバーもアカウント連携もありません。'],
    before: 'いまの Drive',
    after: 'Drive HTML Preview',
    button: 'Web ページとして表示',
    tagline: 'Google ドライブの HTML を、そのまま Web ページに。',
    short: 'Drive の HTML を、そのまま Web ページに。',
    points: ['ワンクリックで表示', 'スクリプトも動く', '文字コード自動判別', 'データ送信なし'],
    privacy: [
      ['サンドボックス表示', 'HTML は拡張機能から隔離された領域で動き、Drive やほかのタブには触れません。'],
      ['外部送信ゼロ', '解析・広告・独自サーバーはありません。読み込みは Drive との直接通信だけ。'],
      ['最小限の権限', '必要なのは Drive へのアクセスと右クリックメニューだけです。'],
    ],
  },
  en: {
    s1: ['Drive HTML files,<br>as pages, not source.', 'Google Drive shows HTML files as raw code. Open them as the real web page in one click.'],
    s2: ['One button, right where<br>you open the file.', 'A “Preview as web page” button appears on Drive’s preview and file pages. Click it and the page opens in the next tab.'],
    s3: ['Flip between<br>page and code.', 'Switch between the rendered page and its source. Encodings such as Shift_JIS are detected automatically.'],
    s4: ['Your files stay<br>with you.', 'Your browser loads the file straight from Drive and renders it in a sandbox. No servers, no sign-in, no tracking.'],
    before: 'Google Drive today',
    after: 'Drive HTML Preview',
    button: 'Preview as web page',
    tagline: 'Open Google Drive HTML files as real web pages.',
    short: 'Drive HTML files as real web pages.',
    points: ['One click', 'Scripts run', 'Any encoding', 'No data sent'],
    privacy: [
      ['Sandboxed', 'The page runs isolated from the extension, from Drive and from your other tabs.'],
      ['Nothing sent anywhere', 'No analytics, no ads, no servers of ours. Just your browser talking to Drive.'],
      ['Minimal permissions', 'Access to Drive and a right-click menu item. That’s it.'],
    ],
  },
};

// Single quotes: this string goes inside double-quoted style attributes.
const FONT = `'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Helvetica Neue',Arial,sans-serif`;
const BG = `radial-gradient(1200px 600px at 85% -10%, rgba(240,101,41,.35), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(227,79,38,.25), transparent 60%), #17120f`;

const SOURCE_LINES = [
  '<span style="color:#9a6">&lt;!doctype html&gt;</span>',
  '<span style="color:#e06c4a">&lt;html</span> lang="ja"<span style="color:#e06c4a">&gt;</span>',
  '<span style="color:#e06c4a">&lt;head&gt;</span>',
  '  <span style="color:#e06c4a">&lt;meta</span> charset="utf-8"<span style="color:#e06c4a">&gt;</span>',
  '  <span style="color:#e06c4a">&lt;title&gt;</span>Q3 Sales Report<span style="color:#e06c4a">&lt;/title&gt;</span>',
  '  <span style="color:#e06c4a">&lt;style&gt;</span>',
  '    :root { --ink:#1d1d1f; --muted:#6e6e73; }',
  '    body { margin:0; font-family: system-ui; }',
  '    header { background: linear-gradient(120deg,…); }',
  '    .kpis { display:grid; grid-template-columns:…; }',
  '    .card { background:#fff; border-radius:16px; }',
  '    .bar { flex:1; border-radius:8px 8px 0 0; }',
  '  <span style="color:#e06c4a">&lt;/style&gt;</span>',
  '<span style="color:#e06c4a">&lt;/head&gt;</span>',
  '<span style="color:#e06c4a">&lt;body&gt;</span>',
  '<span style="color:#e06c4a">&lt;header&gt;</span>',
  '  <span style="color:#e06c4a">&lt;h1&gt;</span>2026年 第3四半期 売上レポート<span style="color:#e06c4a">&lt;/h1&gt;</span>',
  '  <span style="color:#e06c4a">&lt;p&gt;</span>Google ドライブに保存した HTML が…<span style="color:#e06c4a">&lt;/p&gt;</span>',
  '<span style="color:#e06c4a">&lt;/header&gt;</span>',
  '<span style="color:#e06c4a">&lt;main&gt;</span>',
  '  <span style="color:#e06c4a">&lt;section</span> class="kpis"<span style="color:#e06c4a">&gt;</span>',
  '    <span style="color:#e06c4a">&lt;div</span> class="card kpi"<span style="color:#e06c4a">&gt;</span>…',
];

// A neutral stand-in for a file viewer that shows HTML as text.
function sourceViewer(name, { button = '', lines = 22, height = 560 } = {}) {
  return `<div style="position:relative;height:${height}px;border-radius:16px;overflow:hidden;background:#2b2b2e;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:${FONT}">
    <div style="height:48px;display:flex;align-items:center;gap:12px;padding:0 18px;color:#e8e8ea;font-size:15px;font-weight:600;border-bottom:1px solid #3a3a3e">
      <span style="width:18px;height:22px;border-radius:3px;background:#5b8def;display:inline-block"></span>${name}
    </div>
    <div style="position:absolute;top:66px;left:28px;right:28px;bottom:0;background:#fff;border-radius:4px 4px 0 0;padding:22px 26px;font:13px/1.75 ui-monospace,Menlo,monospace;color:#333;white-space:pre;overflow:hidden">${SOURCE_LINES.slice(0, lines).join('\n')}</div>
    ${button}
  </div>`;
}

function pill(text, scale = 1) {
  return `<div style="display:inline-flex;align-items:center;gap:${10 * scale}px;padding:${12 * scale}px ${20 * scale}px ${12 * scale}px ${16 * scale}px;border-radius:999px;background:#D2441F;color:#fff;font:700 ${15 * scale}px/1.2 ${FONT};box-shadow:0 10px 30px rgba(227,79,38,.55),0 2px 6px rgba(0,0,0,.3)">
    <svg viewBox="0 0 24 24" width="${20 * scale}" height="${20 * scale}"><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M8 7l-5 5 5 5M16 7l5 5-5 5"/><path fill="#fff" d="M10.5 9.2v5.6c0 .5.5.8.9.5l4.3-2.8c.4-.2.4-.8 0-1l-4.3-2.8c-.4-.3-.9 0-.9.5z"/></svg>${text}</div>`;
}

function browserFrame(img, { width, height }) {
  return `<div style="width:${width}px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(0,0,0,.55)">
    <div style="height:30px;background:#ececee;display:flex;align-items:center;gap:7px;padding:0 12px">
      <i style="width:11px;height:11px;border-radius:50%;background:#ff5f57"></i><i style="width:11px;height:11px;border-radius:50%;background:#febc2e"></i><i style="width:11px;height:11px;border-radius:50%;background:#28c840"></i>
    </div>
    <img src="${img}" style="display:block;width:${width}px;height:${height}px;object-fit:cover;object-position:top">
  </div>`;
}

function headline(title, body, { width = 470, size = 44 } = {}) {
  return `<div style="width:${width}px;color:#fff;font-family:${FONT}">
    <div style="font-size:${size}px;line-height:1.25;font-weight:800;letter-spacing:-.01em">${title}</div>
    <div style="margin-top:22px;font-size:18px;line-height:1.75;color:#d9cfc9">${body}</div>
  </div>`;
}

function slide(inner) {
  return `<div style="position:relative;width:1280px;height:800px;overflow:hidden;background:${BG}">${inner}</div>`;
}

async function store(page) {
  const icon = await dataUrl('assets/icon.svg', 'image/svg+xml');
  for (const lang of ['ja', 'en']) {
    const c = COPY[lang];
    const shot = (n) => dataUrl(`docs/images/shots/${lang}/${n}.png`, 'image/png');
    const rendered = await shot('viewer-rendered');
    const source = await shot('viewer-source');
    const out = (n) => join(root, 'docs/images/store', lang, `${n}.png`);

    // 1. Before → after.
    await shoot(
      page,
      slide(`
        <div style="position:absolute;left:64px;top:64px">${headline(c.s1[0], c.s1[1], { width: 1100, size: 40 })}</div>
        <div style="position:absolute;left:64px;top:300px;width:400px">
          <div style="color:#b9aca4;font:700 14px ${FONT};letter-spacing:.08em;margin-bottom:12px">${c.before}</div>
          ${sourceViewer('report.html', { lines: 15, height: 420 })}
        </div>
        <svg style="position:absolute;left:486px;top:480px" width="60" height="60" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="#f06529" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div style="position:absolute;left:566px;top:300px">
          <div style="color:#ffb79c;font:700 14px ${FONT};letter-spacing:.08em;margin-bottom:12px">${c.after}</div>
          ${browserFrame(rendered, { width: 650, height: 390 })}
        </div>`),
      1280, 800, out('1-before-after'), false
    );

    // 2. The button.
    await shoot(
      page,
      slide(`
        <div style="position:absolute;left:64px;top:220px">${headline(c.s2[0], c.s2[1], { width: 450, size: 42 })}</div>
        <div style="position:absolute;left:560px;top:90px;width:660px">
          ${sourceViewer('report.html', { lines: 22, height: 620, button: `<div style="position:absolute;right:26px;bottom:26px">${pill(c.button, 1.15)}</div>` })}
        </div>`),
      1280, 800, out('2-button'), false
    );

    // 3. Source toggle.
    await shoot(
      page,
      slide(`
        <div style="position:absolute;left:64px;top:240px">${headline(c.s3[0], c.s3[1], { width: 440, size: 42 })}</div>
        <div style="position:absolute;left:540px;top:120px;transform:rotate(-2deg)">${browserFrame(source, { width: 640, height: 400 })}</div>
        <div style="position:absolute;left:600px;top:290px">${browserFrame(rendered, { width: 640, height: 400 })}</div>`),
      1280, 800, out('3-source'), false
    );

    // 4. Privacy.
    const cards = c.privacy
      .map(
        ([t, d]) => `<div style="flex:1;padding:30px 28px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)">
          <div style="width:44px;height:44px;border-radius:12px;background:#D2441F;display:grid;place-items:center;margin-bottom:20px">
            <svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div style="color:#fff;font:800 22px/1.4 ${FONT}">${t}</div>
          <div style="margin-top:12px;color:#d9cfc9;font:16px/1.75 ${FONT}">${d}</div>
        </div>`
      )
      .join('');
    await shoot(
      page,
      slide(`
        <div style="position:absolute;left:64px;top:90px">${headline(c.s4[0], c.s4[1], { width: 1000 })}</div>
        <div style="position:absolute;left:64px;right:64px;top:420px;display:flex;gap:24px">${cards}</div>`),
      1280, 800, out('4-privacy'), false
    );

    // Promo tiles.
    const chips = c.points
      .map((p) => `<span style="padding:8px 16px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#f3e9e4;font:600 17px ${FONT}">${p}</span>`)
      .join('');
    await shoot(
      page,
      `<div style="width:440px;height:280px;background:${BG};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:${FONT}">
        <img src="${icon}" width="96" height="96">
        <div style="color:#fff;font:800 28px/1.1 ${FONT};letter-spacing:-.01em">Drive HTML Preview</div>
        <div style="color:#e2d6cf;font:500 15px/1.4 ${FONT};text-align:center;padding:0 24px">${c.short}</div>
      </div>`,
      440, 280, out('promo-small'), false
    );
    await shoot(
      page,
      `<div style="position:relative;width:1400px;height:560px;overflow:hidden;background:${BG};font-family:${FONT}">
        <div style="position:absolute;left:80px;top:150px;display:flex;align-items:center;gap:28px">
          <img src="${icon}" width="120" height="120">
          <div style="color:#fff;font:800 56px/1 ${FONT};letter-spacing:-.02em">Drive HTML<br>Preview</div>
        </div>
        <div style="position:absolute;left:80px;top:320px;width:560px;color:#e2d6cf;font:500 22px/1.6 ${FONT}">${c.tagline}</div>
        <div style="position:absolute;left:80px;top:410px;display:flex;flex-wrap:wrap;gap:10px;width:600px">${chips}</div>
        <div style="position:absolute;left:720px;top:70px;transform:rotate(-1.5deg)">${browserFrame(rendered, { width: 640, height: 420 })}</div>
      </div>`,
      1400, 560, out('promo-marquee'), false
    );
  }

  // README hero and GitHub social preview (English UI, bilingual copy lives in the README).
  const rendered = await dataUrl('docs/images/shots/en/viewer-rendered.png', 'image/png');
  await shoot(
    page,
    `<div style="position:relative;width:1280px;height:640px;overflow:hidden;background:${BG};font-family:${FONT}">
      <div style="position:absolute;left:72px;top:150px;display:flex;align-items:center;gap:22px">
        <img src="${icon}" width="96" height="96">
        <div style="color:#fff;font:800 50px/1.05 ${FONT};letter-spacing:-.02em">Drive HTML<br>Preview</div>
      </div>
      <div style="position:absolute;left:72px;top:290px;width:500px;color:#e2d6cf;font:500 20px/1.65 ${FONT}">Open Google Drive HTML files<br>as real web pages.<br>Google ドライブの HTML を、<br>そのまま Web ページに。</div>
      <div style="position:absolute;left:72px;top:490px">${pill('Preview as web page', 1.1)}</div>
      <div style="position:absolute;left:600px;top:80px;transform:rotate(-1.5deg)">${browserFrame(rendered, { width: 620, height: 440 })}</div>
    </div>`,
    1280, 640, join(root, 'docs/images/social-preview.png'), false
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
if (what === 'icons' || what === 'all') await icons(page);
if (what === 'store' || what === 'all') await store(page);
await browser.close();
