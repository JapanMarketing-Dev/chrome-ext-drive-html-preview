// Integration test: loads the real extension into Chromium, serves Drive-like
// responses through request routing and checks the whole flow end to end.
// Run with: npm run test:integration
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, cp, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
let extPath = join(root, 'src');
const shots = process.env.SHOTS_DIR || '';
// UI language for screenshots: UI_LANG=ja|en. Chrome on macOS ignores --lang, so a copy
// of the extension that only ships that locale is loaded instead.
const uiLang = process.env.UI_LANG || '';
const require = createRequire(import.meta.url);
const ja = require('../../src/_locales/ja/messages.json');
const en = require('../../src/_locales/en/messages.json');
// The UI language follows the OS, so accept either locale.
const msg = (key) => new RegExp(`^(?:${[ja[key].message, en[key].message].map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);

const IDS = {
  demo: '1DemoDemoDemoDemoDemoDemoDemoDemo',
  sjis: '1SjisSjisSjisSjisSjisSjisSjisSji',
  denied: '1dddddddddddddddddddddddddddddddd',
  missing: '1mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  signedOut: '1ssssssssssssssssssssssssssssssss',
  limited: '1llllllllllllllllllllllllllllllll',
  crash: '1cccccccccccccccccccccccccccccccc',
  links: '1kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
};

let context;
let extId;
let userDataDir;
const downloadRequests = [];

async function drivePage(route, title, body) {
  await route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`,
  });
}

before(async () => {
  const demo = await readFile(join(root, 'docs/demo/drive-html-preview-demo.html'));
  const sjis = await readFile(join(root, 'docs/demo/sjis-sample.html'));
  const links = Buffer.from(
    '<!doctype html><meta charset="utf-8"><h1 id="top">Links</h1>' +
      '<a id="ext" href="https://example.com/">ext</a> <a id="rel" href="other.html">rel</a> <a id="frag" href="#bottom">frag</a>' +
      '<div style="height:3000px"></div><p id="bottom">bottom</p>' +
      '<script>window.parentAccess = (() => { try { return typeof chrome !== "undefined" && !!(chrome.runtime && chrome.runtime.id) ? "chrome-api" : (parent.document ? "parent-dom" : "none"); } catch (e) { return "blocked"; } })(); document.title = "links:" + window.parentAccess + ":" + location.origin;</script>'
  );

  userDataDir = await mkdtemp(join(tmpdir(), 'dhp-'));
  if (uiLang) {
    extPath = join(userDataDir, 'ext');
    await cp(join(root, 'src'), extPath, { recursive: true });
    for (const locale of await readdir(join(extPath, '_locales'))) {
      if (locale !== uiLang) await rm(join(extPath, '_locales', locale), { recursive: true });
    }
    const manifest = JSON.parse(await readFile(join(extPath, 'manifest.json'), 'utf8'));
    manifest.default_locale = uiLang;
    await writeFile(join(extPath, 'manifest.json'), JSON.stringify(manifest));
  }
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${extPath}`, `--load-extension=${extPath}`],
    locale: uiLang === 'en' ? 'en-US' : 'ja-JP',
    viewport: { width: 1280, height: 800 },
  });

  // Real Drive answers with a redirect to drive.usercontent.google.com; Playwright cannot
  // route the redirected request, so the final response is served directly.
  await context.route('https://drive.google.com/uc?**', async (route) => {
    const url = new URL(route.request().url());
    downloadRequests.push(url.toString());
    const id = url.searchParams.get('id');
    const attach = (name) => ({ 'content-disposition': `attachment; filename="${name}"` });
    switch (id) {
      case IDS.demo:
        return route.fulfill({ status: 200, contentType: 'text/html', headers: attach('drive-html-preview-demo.html'), body: demo });
      case IDS.sjis:
        return route.fulfill({ status: 200, contentType: 'text/html', headers: attach('sjis-sample.html'), body: sjis });
      case IDS.links:
        return route.fulfill({ status: 200, contentType: 'text/html', headers: attach('links.html'), body: links });
      case IDS.denied:
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Google Drive - アクセス権が必要です</body></html>' });
      case IDS.missing:
        return route.fulfill({ status: 404, contentType: 'text/html', body: 'Not Found' });
      case IDS.limited:
        return route.fulfill({ status: 429, contentType: 'text/html', body: 'Too many' });
      case IDS.crash:
        return route.fulfill({ status: 500, contentType: 'text/html', body: 'oops' });
      case IDS.signedOut:
        return route.fulfill({ status: 302, headers: { location: 'https://accounts.google.com/ServiceLogin?continue=x' } });
      default:
        return route.fulfill({ status: 404, body: '' });
    }
  });
  await context.route('https://accounts.google.com/**', (route) => drivePage(route, 'Sign in', 'sign in'));

  // Minimal stand-ins for Drive pages so the content script has something to work on.
  await context.route(`https://drive.google.com/file/d/**`, (route) => {
    const name = /sjis/.test(route.request().url()) ? 'sjis-sample.html' : 'drive-html-preview-demo.html';
    return drivePage(route, `${name} - Google ドライブ`, '<pre>&lt;!doctype html&gt;…</pre>');
  });
  await context.route('https://drive.google.com/drive/**', (route) =>
    drivePage(
      route,
      'マイドライブ - Google ドライブ',
      `<table>
        <tr data-id="${IDS.demo}"><td><div><strong>list.html</strong></div></td></tr>
        <tr data-id="${IDS.sjis}"><td><div><strong>list.html</strong></div></td></tr>
        <tr data-id="1nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn"><td><div><strong>notes.txt</strong></div></td></tr>
      </table>`
    )
  );

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  extId = new URL(worker.url()).host;
  if (shots) await mkdir(shots, { recursive: true });
});

after(async () => {
  await context?.close();
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true });
});

const viewer = (q) => `chrome-extension://${extId}/viewer.html${q ? '?' + q : ''}`;

async function openViewer(id, extra = '') {
  const page = await context.newPage();
  await page.goto(viewer(`id=${id}${extra}`));
  return page;
}

function previewFrame(page) {
  return page.frames().find((f) => f.url().endsWith('/sandbox.html'));
}

test('renders an HTML file as a page and runs its scripts', async () => {
  const page = await openViewer(IDS.demo, '&name=drive-html-preview-demo.html');
  await page.waitForFunction(() => {
    const f = document.getElementById('frame');
    return !f.hidden && f.contentDocument === null; // cross-origin (sandboxed) frame
  });
  let frame;
  await assert.doesNotReject(async () => {
    for (let i = 0; i < 50 && !(frame = previewFrame(page)); i++) await page.waitForTimeout(100);
  });
  await frame.waitForSelector('h1');
  assert.equal(await frame.textContent('h1'), '2026年 第3四半期 売上レポート');
  assert.equal(await frame.evaluate(() => document.body.dataset.scriptRan), 'yes');
  assert.equal(await frame.locator('.bar').count(), 6);
  // Headless Chromium drops real mouse input near the bottom of out-of-process frames,
  // so dispatch the click (checked by hand in headed Chromium).
  await frame.dispatchEvent('#run', 'click');
  assert.match(await frame.textContent('#status'), /正常に動作/);

  assert.equal(await page.textContent('#fileName'), 'drive-html-preview-demo.html');
  assert.equal(await page.textContent('#charset'), 'UTF-8');
  assert.equal(await page.title(), 'drive-html-preview-demo.html – Drive HTML Preview');
  assert.equal(await page.getAttribute('#openDrive', 'href'), `https://drive.google.com/file/d/${IDS.demo}/view`);
  if (shots) {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(shots, 'viewer-rendered.png') });
  }

  await page.click('#modeSource');
  assert.equal(await page.isVisible('#source'), true);
  assert.match(await page.textContent('#source'), /^<!doctype html>/);
  if (shots) await page.screenshot({ path: join(shots, 'viewer-source.png') });
  await page.click('#modeRendered');
  assert.equal(await page.isVisible('#frame'), true);
  await page.close();
});

test('decodes Shift_JIS and allows scripts from a CDN', async () => {
  const page = await openViewer(IDS.sjis);
  let frame;
  for (let i = 0; i < 50 && !(frame = previewFrame(page)); i++) await page.waitForTimeout(100);
  await frame.waitForSelector('#h');
  assert.equal(await frame.textContent('#h'), '日本語の見出し（Shift_JIS）');
  assert.equal(await page.textContent('#charset'), 'SHIFT_JIS');
  // Name comes from Content-Disposition when the query has none.
  assert.equal(await page.textContent('#fileName'), 'sjis-sample.html');
  await frame.waitForFunction(() => /CDN/.test(document.getElementById('cdn').textContent) && !/未読込/.test(document.getElementById('cdn').textContent), null, { timeout: 15000 });
  assert.equal(await frame.textContent('#cdn'), 'CDN スクリプト読込 OK 2026/10/13');
  await page.close();
});

test('the preview is isolated from the extension and from Drive', async () => {
  const page = await openViewer(IDS.links);
  let frame;
  for (let i = 0; i < 50 && !(frame = previewFrame(page)); i++) await page.waitForTimeout(100);
  await frame.waitForSelector('#top');
  assert.equal(await frame.evaluate(() => window.parentAccess), 'blocked');
  assert.equal(await frame.evaluate(() => self.origin), 'null');
  assert.equal(await frame.evaluate(() => { try { return document.cookie; } catch (e) { return 'blocked'; } }), 'blocked');
  assert.equal(await frame.evaluate(() => typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage), true);
  await page.close();
});

test('links: external opens a new tab, relative is blocked, fragment scrolls', async () => {
  const page = await openViewer(IDS.links);
  let frame;
  for (let i = 0; i < 50 && !(frame = previewFrame(page)); i++) await page.waitForTimeout(100);
  await frame.waitForSelector('#ext');

  const popupPromise = context.waitForEvent('page');
  await frame.click('#ext');
  const popup = await popupPromise;
  assert.match(popup.url(), /^https:\/\/example\.com\/?$|^about:blank$/);
  await popup.close();

  const before = frame.url();
  await frame.click('#rel');
  await page.waitForTimeout(300);
  assert.equal(frame.url(), before, 'relative link did not navigate');
  assert.ok(await frame.$('#top'), 'document still shown');

  await frame.click('#frag');
  await page.waitForTimeout(300);
  assert.ok((await frame.evaluate(() => window.scrollY)) > 1000, 'scrolled to fragment');
  await page.close();
});

for (const [key, pattern] of [
  ['denied', msg('error_no_access')],
  ['missing', msg('error_not_found')],
  ['signedOut', msg('error_no_access')],
  ['limited', msg('error_rate_limited')],
  ['crash', msg('error_http_error')],
]) {
  test(`error state: ${key}`, async () => {
    const page = await openViewer(IDS[key]);
    await page.waitForSelector('#error:not([hidden])');
    assert.match(await page.textContent('#errorMessage'), pattern);
    assert.equal(await page.isVisible('#frame'), false);
    assert.equal(await page.isVisible('#actions'), false);
    assert.equal(await page.getAttribute('#errorOpenDrive', 'href'), `https://drive.google.com/file/d/${IDS[key]}/view`);
    if (shots && key === 'denied') await page.screenshot({ path: join(shots, 'viewer-error.png') });
    // Retry re-requests and lands in the same state.
    const count = downloadRequests.length;
    await page.click('#retry');
    await page.waitForSelector('#error:not([hidden])');
    assert.equal(downloadRequests.length, count + 1);
    await page.close();
  });
}

test('authuser and resourcekey are passed to the download', async () => {
  const page = await openViewer(IDS.demo, '&authuser=1&resourcekey=0-abc');
  await page.waitForSelector('#actions:not([hidden])');
  const last = new URL(downloadRequests.at(-1));
  assert.equal(last.searchParams.get('authuser'), '1');
  assert.equal(last.searchParams.get('resourcekey'), '0-abc');
  assert.equal(await page.getAttribute('#openDrive', 'href'), `https://drive.google.com/file/d/${IDS.demo}/view?resourcekey=0-abc&authuser=1`);
  await page.close();
});

test('reload fetches again', async () => {
  const page = await openViewer(IDS.demo);
  await page.waitForSelector('#actions:not([hidden])');
  const count = downloadRequests.length;
  await page.click('#reload');
  await page.waitForSelector('#actions:not([hidden])');
  assert.equal(downloadRequests.length, count + 1);
  await page.close();
});

test('empty viewer: paste a link', async () => {
  const page = await context.newPage();
  await page.goto(viewer(''));
  assert.equal(await page.isVisible('#empty'), true);
  if (shots) await page.screenshot({ path: join(shots, 'viewer-empty.png') });
  await page.fill('#urlInput', 'https://example.com/not-drive');
  await page.click('#urlForm button');
  assert.equal(await page.isVisible('#urlError'), true);
  await page.fill('#urlInput', `https://drive.google.com/file/d/${IDS.demo}/view?usp=sharing`);
  assert.equal(await page.isVisible('#urlError'), false);
  await page.click('#urlForm button');
  await page.waitForURL(/viewer\.html\?id=/);
  await page.waitForSelector('#actions:not([hidden])');
  assert.equal(await page.textContent('#fileName'), 'drive-html-preview-demo.html');
  await page.close();
});

test('invalid id in the viewer URL shows the empty state', async () => {
  const page = await context.newPage();
  await page.goto(viewer('id=../../evil'));
  assert.equal(await page.isVisible('#empty'), true);
  await page.close();
});

test('Drive file page: button appears and opens the viewer next to it', async () => {
  const page = await context.newPage();
  await page.goto(`https://drive.google.com/file/d/${IDS.demo}/view`);
  const button = page.locator('#drive-html-preview-host button');
  await button.waitFor();
  assert.match(await button.textContent(), msg('previewButton'));
  if (shots) await page.screenshot({ path: join(shots, 'drive-button.png') });
  const opened = context.waitForEvent('page');
  await button.click();
  const tab = await opened;
  await tab.waitForURL(/viewer\.html/);
  const q = new URL(tab.url()).searchParams;
  assert.equal(q.get('id'), IDS.demo);
  assert.equal(q.get('name'), 'drive-html-preview-demo.html');
  await tab.waitForSelector('#actions:not([hidden])');
  await tab.close();
  await page.close();
});

test('Drive folder overlay: picks the double-clicked file among same-name files', async () => {
  const page = await context.newPage();
  await page.goto('https://drive.google.com/drive/u/1/my-drive');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#drive-html-preview-host').count(), 0, 'no button without a preview');

  await page.dblclick(`tr[data-id="${IDS.sjis}"] strong`);
  await page.evaluate(() =>
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div><span role="button" aria-label="list.html の名前を変更する"><span><span>list.html</span></span></span><div role="dialog" aria-label="ビューアを表示しています。"><div role="main">…</div></div></div>'
    )
  );
  const button = page.locator('#drive-html-preview-host button');
  await button.waitFor();
  const opened = context.waitForEvent('page');
  await button.click();
  const tab = await opened;
  await tab.waitForURL(/viewer\.html/);
  const q = new URL(tab.url()).searchParams;
  assert.equal(q.get('id'), IDS.sjis);
  assert.equal(q.get('authuser'), '1');
  await tab.close();

  await page.evaluate(() => document.querySelector('[role=dialog]').parentElement.remove());
  await page.locator('#drive-html-preview-host').waitFor({ state: 'detached' });
  await page.close();
});
