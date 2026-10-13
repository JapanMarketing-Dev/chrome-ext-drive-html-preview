import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const C = require('../src/content.js');

const A = '1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const X = '1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

// A trimmed-down copy of the markup Drive renders for a file list.
function row(id, name, kind = 'HTML') {
  return `<tr data-id="${id}" role="row" aria-selected="false"><td><div><span>${kind}</span><div><div><strong>${name}</strong></div></div></div></td><td>5月28日</td></tr>`;
}

// Drive's preview overlay: a top-level container holding the header (whose rename
// button is labelled with the file name) and the viewer dialog.
function overlay(name, extra = '') {
  return `<div class="overlay"><div class="hdr"><span role="button" aria-label="${name} の名前を変更する"><span><span>${name}</span></span></span><span>外部</span><div>ファイル</div></div>` +
    `<div role="dialog" aria-label="ビューアを表示しています。"><div role="main"><div class="scroll" style="overflow-y:auto">` +
    `<div role="document"><pre>&lt;h1&gt;Hi&lt;/h1&gt;\n</pre></div><div role="document"><pre>&lt;p&gt;page 2&lt;/p&gt;</pre></div>` +
    `</div><div>other.html</div></div>${extra}</div></div>`;
}

function dom(body, url = 'https://drive.google.com/drive/search?q=.html', title = '検索結果 - Google ドライブ') {
  const d = new JSDOM(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`, { url });
  return d.window;
}

test('file page: id from URL, name from title', () => {
  const w = dom('', `https://drive.google.com/file/d/${A}/view`, 'article.html - Google ドライブ');
  assert.deepEqual(C.detectCurrentFile(w.document, w.location.href, null), { file: { id: A }, name: 'article.html' });
});

test('file page: account index and resource key carried over', () => {
  const w = dom('', `https://drive.google.com/file/u/1/d/${A}/view?resourcekey=0-k`, 'a.htm - Google Drive');
  assert.deepEqual(C.detectCurrentFile(w.document, w.location.href, null), {
    file: { id: A, resourceKey: '0-k', authuser: '1' },
    name: 'a.htm',
  });
});

test('file page: non-HTML files are ignored', () => {
  for (const title of ['report.pdf - Google ドライブ', 'Google ドライブ', '']) {
    const w = dom('', `https://drive.google.com/file/d/${A}/view`, title);
    assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null, title);
  }
});

test('overlay: unique name resolves to its row', () => {
  const w = dom(`<table>${row(A, 'article.html')}${row(B, 'default.tgz', '圧縮')}</table>${overlay('article.html')}`);
  assert.equal(C.findOverlayName(w.document), 'article.html');
  const found = C.detectCurrentFile(w.document, w.location.href, null);
  assert.deepEqual(found.file, { id: A });
  assert.equal(found.name, 'article.html');
});

test('overlay: no dialog or non-HTML dialog means nothing to preview', () => {
  let w = dom(`<table>${row(A, 'article.html')}</table>`);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null);
  w = dom(`<table>${row(A, 'photo.png', '画像')}</table>${overlay('photo.png')}`);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null);
});

test('overlay: hidden dialogs are ignored', () => {
  const w = dom(`<table>${row(A, 'article.html')}</table>${overlay('article.html')}`);
  w.document.querySelector('[role=dialog]').style.display = 'none';
  assert.equal(C.findOverlayName(w.document), null);
  w.document.querySelector('[role=dialog]').style.display = '';
  w.document.querySelector('[role=dialog]').setAttribute('aria-hidden', 'true');
  assert.equal(C.findOverlayName(w.document), null);
});

test('overlay: names only in the viewer body, tooltips or hidden nodes do not count', () => {
  const w = dom(
    `<table>${row(A, 'other.html')}</table><div><div role="dialog"><div>other.html</div></div>` +
      `<span aria-label="other.html"><span aria-hidden="true">other.html</span></span><div role="tooltip" aria-label="other.html">other.html</div></div>`
  );
  assert.equal(C.findOverlayName(w.document), null);
});

test('overlay: a dialog inside the file list container is not a preview', () => {
  const w = dom(`<div><table role="grid">${row(A, 'a.html')}</table><div role="dialog" aria-label="共有"><span aria-label="a.html を共有"><span>a.html</span></span></div></div>`);
  assert.equal(C.findOverlayName(w.document), null);
});

test('overlay: other top-level panels (upload progress) are not mistaken for the viewer', () => {
  const w = dom(
    `<table>${row(A, 'up.html')}${row(B, 'photo.png', '画像')}</table>${overlay('photo.png')}` +
      `<div class="uploads"><span aria-label="up.html アップロード完了"><span>up.html</span></span></div>`
  );
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null);
});

test('overlay: duplicate names need the last activated row', () => {
  const html = `<table>${row(A, 'list.html')}${row(B, 'list.html')}</table>${overlay('list.html')}`;
  const w = dom(html);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, B).file.id, B);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, A).file.id, A);
  // A stale activation for another file does not pick an arbitrary duplicate.
  assert.equal(C.detectCurrentFile(w.document, w.location.href, X), null);
});

test('overlay: activation of a different file is overridden by a unique name match', () => {
  const w = dom(`<table>${row(A, 'one.html')}${row(B, 'two.html')}</table>${overlay('two.html')}`);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, A).file.id, B);
});

test('overlay: account index from the folder URL', () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`, 'https://drive.google.com/drive/u/2/folders/abc');
  assert.deepEqual(C.detectCurrentFile(w.document, w.location.href, null).file, { id: A, authuser: '2' });
});

test('overlay: name with special characters', () => {
  const name = 'レポート &amp; 資料 (最終).html';
  const w = dom(`<table>${row(A, name)}</table>${overlay(name)}`);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null).name, 'レポート & 資料 (最終).html');
});

test('overlay: rows with invalid ids are skipped', () => {
  const w = dom(`<table>${row('bad', 'a.html')}</table>${overlay('a.html')}`);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null), null);
});

test('overlay: previous detection is reused while the same file stays open', () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  const first = C.detectCurrentFile(w.document, w.location.href, null);
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null, first), first);
  const header = w.document.querySelector('.hdr [role=button]');
  header.setAttribute('aria-label', 'b.html の名前を変更する');
  header.querySelector('span span').textContent = 'b.html';
  assert.equal(C.detectCurrentFile(w.document, w.location.href, null, first), null);
});

test('idsForName and itemNameOf', () => {
  const w = dom(`<table>${row(A, 'a.html')}${row(B, 'b.txt', 'テキスト')}</table><div data-id="${X}" aria-label="c.html"></div>`);
  assert.deepEqual(C.idsForName(w.document, 'a.html'), [A]);
  assert.deepEqual(C.idsForName(w.document, 'c.html'), [X]);
  assert.deepEqual(C.idsForName(w.document, 'zzz.html'), []);
  assert.equal(C.itemNameOf(w.document.querySelector(`[data-id="${A}"]`)), 'a.html');
  assert.equal(C.itemNameOf(w.document.querySelector(`[data-id="${B}"]`)), null);
});

test('findSourcePane: Drive text pages inside the overlay and their scroll area', () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  const pane = C.findSourcePane(w.document);
  assert.equal(pane.pages.length, 2);
  assert.equal(pane.scroller.className, 'scroll');
  assert.equal(C.sourceText(pane), '<h1>Hi</h1>\n<p>page 2</p>');
});

test('findSourcePane: file page without a dialog', () => {
  const w = dom(`<div style="overflow-y:scroll" id="s"><div role="document"><pre>&lt;b&gt;x&lt;/b&gt;</pre></div></div>`, `https://drive.google.com/file/d/${A}/view`, 'a.html - Google ドライブ');
  const pane = C.findSourcePane(w.document);
  assert.equal(pane.scroller.id, 's');
  assert.equal(C.sourceText(pane), '<b>x</b>');
});

test('findSourcePane: nothing while Drive is still loading or shows something else', () => {
  assert.equal(C.findSourcePane(dom('<div style="overflow-y:auto"><div role="document"></div></div>').document), null, 'no text yet');
  assert.equal(C.findSourcePane(dom('<div role="document"><pre>x</pre></div>').document), null, 'no scroll area');
  const hidden = dom('<div style="overflow-y:auto"><div role="document" style="display:none"><pre>x</pre></div></div>');
  assert.equal(C.findSourcePane(hidden.document), null);
});

test('frameRect leaves room for the arrows on wide screens only', () => {
  const el = (left, top, width, height) => ({ getBoundingClientRect: () => ({ left, top, width, height }) });
  assert.deepEqual(C.frameRect(el(0, 128, 1375, 672)), { left: C.SIDE_GAP, top: 128, width: 1375 - C.SIDE_GAP * 2, height: 672 });
  assert.deepEqual(C.frameRect(el(10, 50, 400, 300)), { left: 10, top: 50, width: 400, height: 300 });
});

test('ensureEmbed: one frame, src follows the file, style only rewritten on change', () => {
  const w = dom('');
  const rect = { left: 72, top: 128, width: 1231, height: 672 };
  const host = C.ensureEmbed(w.document, { id: A }, 'a.html', rect);
  const frame = host.querySelector('iframe');
  assert.equal(frame.getAttribute('src'), `viewer.html?embed=1&id=${A}&name=a.html`);
  assert.match(host.style.cssText, /position: fixed/);
  assert.equal(host.style.left, '72px');
  const css = host.dataset.css;
  assert.equal(C.ensureEmbed(w.document, { id: A }, 'a.html', rect), host);
  assert.equal(host.dataset.css, css);
  C.ensureEmbed(w.document, { id: B, authuser: '1' }, 'b.html', { ...rect, height: 500 });
  assert.equal(w.document.querySelectorAll('#' + C.HOST_ID).length, 1);
  assert.equal(host.querySelector('iframe'), frame, 'same frame reused');
  assert.equal(frame.getAttribute('src'), `viewer.html?embed=1&id=${B}&authuser=1&name=b.html`);
  assert.equal(host.style.height, '500px');
  C.removeEmbed(w.document);
  assert.equal(w.document.getElementById(C.HOST_ID), null);
  C.removeEmbed(w.document);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('controller: lays the page over the preview, follows navigation, removes on close', async () => {
  const w = dom(`<table>${row(A, 'list.html')}${row(B, 'list.html')}${row(X, 'next.html')}</table>`);
  const ctl = C.createController(w.document, w);
  ctl.start();
  assert.equal(w.document.getElementById(C.HOST_ID), null);

  w.document.querySelector(`[data-id="${B}"] strong`).dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  w.document.body.insertAdjacentHTML('beforeend', overlay('list.html'));
  await wait(300);
  const frame = w.document.querySelector(`#${C.HOST_ID} iframe`);
  assert.ok(frame, 'embedded');
  assert.match(frame.getAttribute('src'), new RegExp(`id=${B}`));

  // Drive's "next" arrow swaps the header and the pages in place.
  const header = w.document.querySelector('.hdr [role=button]');
  header.setAttribute('aria-label', 'next.html の名前を変更する');
  header.querySelector('span span').textContent = 'next.html';
  await wait(300);
  assert.match(w.document.querySelector(`#${C.HOST_ID} iframe`).getAttribute('src'), new RegExp(`id=${X}&name=next.html`));

  w.document.querySelector('.overlay').remove();
  await wait(300);
  assert.equal(w.document.getElementById(C.HOST_ID), null);
});

test('controller: no overlay for HTML files until Drive has drawn the text pages', async () => {
  const w = dom(`<table>${row(A, 'a.html')}</table><div class="overlay"><span role="button" aria-label="a.html の名前を変更する"><span>a.html</span></span><div role="dialog"><div class="spinner"></div></div></div>`);
  const ctl = C.createController(w.document, w);
  ctl.start();
  assert.equal(w.document.getElementById(C.HOST_ID), null);
  assert.equal(ctl.getCurrent().file.id, A);
  w.document.querySelector('.spinner').outerHTML = '<div style="overflow-y:auto"><div role="document"><pre>&lt;p&gt;x&lt;/p&gt;</pre></div></div>';
  await wait(300);
  assert.ok(w.document.getElementById(C.HOST_ID));
});

test('controller: hands Drive\'s text to its own frame only', async () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  const ctl = C.createController(w.document, w);
  ctl.start();
  const frame = w.document.querySelector(`#${C.HOST_ID} iframe`);
  const replies = [];
  const fakeFrameWindow = { postMessage: (data, origin) => replies.push([data, origin]) };
  Object.defineProperty(frame, 'contentWindow', { value: fakeFrameWindow });
  w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'dhp-need-text' }, source: {} }));
  assert.equal(replies.length, 0, 'ignores other windows');
  w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'other' }, source: fakeFrameWindow }));
  assert.equal(replies.length, 0, 'ignores other messages');
  w.dispatchEvent(new w.MessageEvent('message', { data: { type: 'dhp-need-text' }, source: fakeFrameWindow }));
  assert.deepEqual(replies[0][0], { type: 'dhp-text', text: '<h1>Hi</h1>\n<p>page 2</p>' });
});

test('controller: reacts to attribute-only changes elsewhere on the page', async () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  const ctl = C.createController(w.document, w);
  ctl.start();
  assert.ok(w.document.getElementById(C.HOST_ID));
  w.document.querySelector('[role=dialog]').setAttribute('aria-hidden', 'true');
  await wait(300);
  assert.equal(w.document.getElementById(C.HOST_ID), null);
});

test('controller: its own style writes do not keep it busy', async () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  let refreshes = 0;
  const realSetTimeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms) => realSetTimeout(() => { refreshes++; fn(); }, ms);
  const ctl = C.createController(w.document, w);
  ctl.start();
  await wait(800);
  assert.ok(refreshes <= 1, `refreshed ${refreshes} times`);
});
