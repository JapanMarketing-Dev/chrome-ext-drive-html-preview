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
    `<div role="dialog" aria-label="ビューアを表示しています。"><div role="main"><pre>&lt;a href="x.html"&gt;</pre><div>other.html</div></div>${extra}</div></div>`;
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

test('button is created once inside a shadow root and removed', () => {
  const w = dom('');
  let clicks = 0;
  const host = C.ensureButton(w.document, () => clicks++);
  assert.equal(C.ensureButton(w.document, () => {}), host);
  assert.equal(w.document.querySelectorAll('#' + C.HOST_ID).length, 1);
  const button = host.shadowRoot.querySelector('button');
  assert.equal(button.textContent, 'Preview as web page');
  button.click();
  assert.equal(clicks, 1);
  C.removeButton(w.document);
  assert.equal(w.document.getElementById(C.HOST_ID), null);
  C.removeButton(w.document);
});

test('controller: shows the button, sends the open message, hides on close', async () => {
  const w = dom(`<table>${row(A, 'list.html')}${row(B, 'list.html')}</table>`);
  const sent = [];
  const ctl = C.createController(w.document, w, (m) => sent.push(m));
  ctl.start();
  assert.equal(w.document.getElementById(C.HOST_ID), null);

  // User double-clicks the second list.html; Drive opens the overlay.
  const name = w.document.querySelector(`[data-id="${B}"] strong`);
  name.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  w.document.body.insertAdjacentHTML('beforeend', overlay('list.html'));
  await new Promise((r) => setTimeout(r, 400));

  const host = w.document.getElementById(C.HOST_ID);
  assert.ok(host, 'button shown');
  host.shadowRoot.querySelector('button').click();
  assert.deepEqual(sent, [{ type: 'open-preview', file: { id: B }, name: 'list.html' }]);

  w.document.querySelector('[role=dialog]').remove();
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(w.document.getElementById(C.HOST_ID), null, 'button removed');
  assert.equal(ctl.getCurrent(), null);
});

test('controller: clicks on the button itself do not change the tracked row', async () => {
  const w = dom(`<table>${row(A, 'a.html')}</table>${overlay('a.html')}`);
  const ctl = C.createController(w.document, w, () => {});
  ctl.start();
  ctl.setLastActivated(A);
  const host = w.document.getElementById(C.HOST_ID);
  host.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true }));
  ctl.refresh();
  assert.equal(ctl.getCurrent().file.id, A);
});
