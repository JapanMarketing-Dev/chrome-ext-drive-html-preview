import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const H = require('../src/lib/html.js');

const enc = (s) => new TextEncoder().encode(s);
// "日本語" in Shift_JIS and EUC-JP.
const SJIS_NIHONGO = [0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea];
const EUC_NIHONGO = [0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

test('BOM wins over everything', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('<meta charset="shift_jis">日本')]);
  assert.equal(H.detectCharset(bytes, 'text/html; charset=euc-jp'), 'utf-8');
  assert.equal(H.decodeHtml(bytes).text, '<meta charset="shift_jis">日本');
  assert.equal(H.bomCharset(new Uint8Array([0xff, 0xfe, 0x3c, 0])), 'utf-16le');
  assert.equal(H.bomCharset(new Uint8Array([0xfe, 0xff, 0, 0x3c])), 'utf-16be');
  assert.equal(H.bomCharset(new Uint8Array([0xef, 0xbb])), null);
});

test('UTF-16LE file with BOM decodes', () => {
  const s = '<p>日本語</p>';
  const bytes = new Uint8Array(2 + s.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < s.length; i++) {
    bytes[2 + i * 2] = s.charCodeAt(i) & 0xff;
    bytes[3 + i * 2] = s.charCodeAt(i) >> 8;
  }
  assert.deepEqual(H.decodeHtml(bytes), { text: s, charset: 'utf-16le' });
});

test('Content-Type charset beats meta', () => {
  const bytes = new Uint8Array([...ascii('<meta charset="utf-8">'), ...SJIS_NIHONGO]);
  assert.equal(H.decodeHtml(bytes, 'text/html; charset=Shift_JIS').text, '<meta charset="utf-8">日本語');
  assert.equal(H.charsetFromContentType('text/html; charset="EUC-JP"'), 'euc-jp');
  assert.equal(H.charsetFromContentType("text/html;charset='sjis'"), 'shift_jis');
  assert.equal(H.charsetFromContentType('text/html; charset=bogus-enc'), null);
  assert.equal(H.charsetFromContentType('text/html'), null);
  assert.equal(H.charsetFromContentType(undefined), null);
});

test('meta charset forms', () => {
  const cases = [
    ['<meta charset="Shift_JIS">', 'shift_jis'],
    ["<meta charset='euc-jp'>", 'euc-jp'],
    ['<meta charset=windows-31j>', 'shift_jis'],
    ['<META CHARSET="SJIS"/>', 'shift_jis'],
    ['<meta http-equiv="Content-Type" content="text/html; charset=Shift_JIS">', 'shift_jis'],
    ['<meta content="text/html;charset=euc-jp" http-equiv="content-type">', 'euc-jp'],
    ['<meta name="viewport" content="width=device-width"><meta charset="iso-2022-jp">', 'iso-2022-jp'],
  ];
  for (const [html, expected] of cases) assert.equal(H.charsetFromMeta(enc(html)), expected, html);
});

test('meta charset: ignores comments, unknown labels and late declarations', () => {
  assert.equal(H.charsetFromMeta(enc('<!-- <meta charset="shift_jis"> --><p>x</p>')), null);
  assert.equal(H.charsetFromMeta(enc('<meta charset="klingon">')), null);
  assert.equal(H.charsetFromMeta(enc('x'.repeat(5000) + '<meta charset="shift_jis">')), null);
  assert.equal(H.charsetFromMeta(enc('<p>no meta</p>')), null);
});

test('meta declaring UTF-16 in an ASCII stream means UTF-8', () => {
  assert.equal(H.charsetFromMeta(enc('<meta charset="utf-16">')), 'utf-8');
});

test('Shift_JIS and EUC-JP files decode with their meta', () => {
  const sjis = new Uint8Array([...ascii('<meta charset="Shift_JIS"><h1>'), ...SJIS_NIHONGO, ...ascii('</h1>')]);
  assert.deepEqual(H.decodeHtml(sjis), { text: '<meta charset="Shift_JIS"><h1>日本語</h1>', charset: 'shift_jis' });
  const euc = new Uint8Array([...ascii('<meta charset="EUC-JP">'), ...EUC_NIHONGO]);
  assert.deepEqual(H.decodeHtml(euc), { text: '<meta charset="EUC-JP">日本語', charset: 'euc-jp' });
});

test('no declaration: valid UTF-8 stays UTF-8, invalid falls back to Shift_JIS', () => {
  assert.deepEqual(H.decodeHtml(enc('<p>日本語 ✓</p>')), { text: '<p>日本語 ✓</p>', charset: 'utf-8' });
  const sjis = new Uint8Array([...ascii('<p>'), ...SJIS_NIHONGO, ...ascii('</p>')]);
  assert.deepEqual(H.decodeHtml(sjis), { text: '<p>日本語</p>', charset: 'shift_jis' });
});

test('decodeHtml accepts ArrayBuffer and empty input', () => {
  assert.deepEqual(H.decodeHtml(enc('<b>x</b>').buffer), { text: '<b>x</b>', charset: 'utf-8' });
  assert.deepEqual(H.decodeHtml(new ArrayBuffer(0)), { text: '', charset: 'utf-8' });
});

test('decodeHtml rejects files over the size limit', () => {
  const big = new Uint8Array(H.MAX_BYTES + 1);
  assert.throws(() => H.decodeHtml(big), (err) => err.code === 'too_large');
  assert.doesNotThrow(() => H.decodeHtml(new Uint8Array(H.MAX_BYTES)));
});

test('classifyDownload', () => {
  const ok = { ok: true, status: 200, finalUrl: 'https://drive.usercontent.google.com/download?id=x', disposition: 'attachment; filename="a.html"' };
  assert.equal(H.classifyDownload(ok), 'ok');
  assert.equal(H.classifyDownload({ ...ok, disposition: 'Attachment;filename=a.html' }), 'ok');
  // Served by the download host without the header: still the file.
  assert.equal(H.classifyDownload({ ...ok, disposition: null }), 'ok');
  // Google's own pages on drive.google.com (permission request, virus warning…).
  const drivePage = { ...ok, finalUrl: 'https://drive.google.com/uc?export=download&id=x' };
  assert.equal(H.classifyDownload({ ...drivePage, disposition: null }), 'no_access');
  assert.equal(H.classifyDownload({ ...drivePage, disposition: 'inline' }), 'no_access');
  assert.equal(H.classifyDownload({ ...drivePage, disposition: 'attachment; filename=a.html' }), 'ok');
  assert.equal(H.classifyDownload({ ...ok, finalUrl: '', disposition: null }), 'no_access');
  assert.equal(H.classifyDownload({ ...ok, finalUrl: undefined, disposition: null }), 'no_access');
  assert.equal(H.classifyDownload({ ...ok, finalUrl: 'https://drive.usercontent.google.com.evil.example/x', disposition: null }), 'no_access');
  assert.equal(H.classifyDownload({ ...ok, finalUrl: 'https://accounts.google.com/ServiceLogin?continue=x' }), 'signed_out');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 403 }), 'no_access');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 401 }), 'no_access');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 404 }), 'not_found');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 429 }), 'rate_limited');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 500 }), 'http_error');
  assert.equal(H.classifyDownload({ ...ok, ok: false, status: 0 }), 'http_error');
});

test('linkAction', () => {
  const doc = 'chrome-extension://abc/sandbox.html';
  assert.equal(H.linkAction('#top', doc + '#top', doc), 'default');
  assert.equal(H.linkAction('', doc, doc), 'default');
  assert.equal(H.linkAction(null, '', doc), 'default');
  assert.equal(H.linkAction('javascript:void(0)', 'javascript:void(0)', doc), 'default');
  assert.equal(H.linkAction('https://example.com/a', 'https://example.com/a', doc), 'open');
  assert.equal(H.linkAction('//example.com/a', 'https://example.com/a', doc), 'open');
  assert.equal(H.linkAction('mailto:a@b.co', 'mailto:a@b.co', doc), 'open');
  assert.equal(H.linkAction('tel:0312345678', 'tel:0312345678', doc), 'open');
  assert.equal(H.linkAction('page2.html', 'chrome-extension://abc/page2.html', doc), 'block');
  assert.equal(H.linkAction('../x/y.html', 'chrome-extension://abc/x/y.html', doc), 'block');
  assert.equal(H.linkAction('sandbox.html#sec', doc + '#sec', doc), 'default');
  assert.equal(H.linkAction('data:text/html,hi', 'data:text/html,hi', doc), 'block');
  assert.equal(H.linkAction('weird', 'not a url', doc), 'block');
  assert.equal(H.linkAction('https://example.com', 'https://example.com/', 'bad base'), 'open');
});
