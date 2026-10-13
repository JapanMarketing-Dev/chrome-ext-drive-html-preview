import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const D = require('../src/lib/drive.js');

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

test('parseDriveUrl: /file/d/ID/view', () => {
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view`), { id: ID });
});

test('parseDriveUrl: variants of file URLs', () => {
  const cases = [
    `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
    `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
    `https://drive.google.com/file/d/${ID}`,
    `https://drive.google.com/file/d/${ID}/`,
    `https://drive.google.com/file/d/${ID}/edit`,
    `https://drive.google.com/file/d/${ID}/preview`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?id=${ID}&export=download`,
    `https://drive.google.com/uc?export=download&id=${ID}`,
    `https://docs.google.com/file/d/${ID}/edit`,
    `https://drive.usercontent.google.com/download?id=${ID}&export=download`,
    `  https://drive.google.com/file/d/${ID}/view  `,
    `https://drive.google.com/file/d/${ID}/view#heading`,
  ];
  for (const url of cases) assert.equal(D.parseDriveUrl(url)?.id, ID, url);
});

test('parseDriveUrl: account index from /u/N/ and authuser', () => {
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/u/1/d/${ID}/view`), { id: ID, authuser: '1' });
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?authuser=2`), { id: ID, authuser: '2' });
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?authuser=a%40b.co`), {
    id: ID,
    authuser: 'a@b.co',
  });
});

test('parseDriveUrl: resource keys are kept', () => {
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?resourcekey=0-abc_DEF`), {
    id: ID,
    resourceKey: '0-abc_DEF',
  });
});

test('parseDriveUrl: rejects unsafe or invalid resource key and authuser values', () => {
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?resourcekey=a%26b`), { id: ID });
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?authuser=%3Cscript%3E`), { id: ID });
  assert.deepEqual(D.parseDriveUrl(`https://drive.google.com/file/d/${ID}/view?authuser=123`), { id: ID });
});

test('parseDriveUrl: rejects non-Drive and malformed input', () => {
  const bad = [
    '',
    '   ',
    null,
    undefined,
    42,
    'not a url',
    `http://drive.google.com/file/d/${ID}/view`,
    `https://evil.example/file/d/${ID}/view`,
    `https://drive.google.com.evil.example/file/d/${ID}/view`,
    `https://docs.google.com/document/d/${ID}/edit`,
    'https://drive.google.com/drive/my-drive',
    'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp',
    'https://drive.google.com/file/d/short/view',
    'https://drive.google.com/open?id=',
    'https://drive.google.com/open',
    'https://drive.google.com/open?id=has%20space%20inside',
    `javascript:alert('https://drive.google.com/file/d/${ID}')`,
  ];
  for (const url of bad) assert.equal(D.parseDriveUrl(url), null, String(url));
});

test('authuserFromUrl', () => {
  assert.equal(D.authuserFromUrl('https://drive.google.com/drive/u/0/my-drive'), '0');
  assert.equal(D.authuserFromUrl('https://drive.google.com/drive/u/12/folders/x'), '12');
  assert.equal(D.authuserFromUrl('https://drive.google.com/drive/u/3'), '3');
  assert.equal(D.authuserFromUrl('https://drive.google.com/drive/my-drive'), null);
  assert.equal(D.authuserFromUrl('https://drive.google.com/drive/my-drive?authuser=1'), '1');
  assert.equal(D.authuserFromUrl('nope'), null);
  assert.equal(D.authuserFromUrl(new URL('https://drive.google.com/drive/u/4/')), '4');
});

test('buildDownloadUrl', () => {
  assert.equal(D.buildDownloadUrl({ id: ID }), `https://drive.google.com/uc?export=download&id=${ID}`);
  assert.equal(
    D.buildDownloadUrl({ id: ID, resourceKey: '0-x', authuser: '1' }),
    `https://drive.google.com/uc?export=download&id=${ID}&resourcekey=0-x&authuser=1`
  );
  assert.equal(D.buildDownloadUrl({ id: ID, authuser: 0 }), `https://drive.google.com/uc?export=download&id=${ID}&authuser=0`);
  assert.equal(D.buildDownloadUrl({ id: ID, authuser: '' }), `https://drive.google.com/uc?export=download&id=${ID}`);
  assert.throws(() => D.buildDownloadUrl({ id: '../x' }));
  assert.throws(() => D.buildDownloadUrl(null));
});

test('buildDriveViewUrl', () => {
  assert.equal(D.buildDriveViewUrl({ id: ID }), `https://drive.google.com/file/d/${ID}/view`);
  assert.equal(
    D.buildDriveViewUrl({ id: ID, authuser: '2', resourceKey: 'k' }),
    `https://drive.google.com/file/d/${ID}/view?resourcekey=k&authuser=2`
  );
  assert.throws(() => D.buildDriveViewUrl({ id: 'a/b' }));
});

test('viewer query round trip', () => {
  const file = { id: ID, resourceKey: '0-k', authuser: '1' };
  const q = D.buildViewerQuery(file, 'レポート 2026.html');
  assert.deepEqual(D.parseViewerQuery('?' + q), { file, name: 'レポート 2026.html' });
  assert.deepEqual(D.parseViewerQuery(D.buildViewerQuery({ id: ID }, '')), { file: { id: ID }, name: '' });
});

test('viewer query: long names are truncated, bad ids rejected', () => {
  const q = D.buildViewerQuery({ id: ID }, 'a'.repeat(1000));
  assert.equal(D.parseViewerQuery(q).name.length, 255);
  assert.equal(D.parseViewerQuery(''), null);
  assert.equal(D.parseViewerQuery('?id=../../etc'), null);
  assert.equal(D.parseViewerQuery(undefined), null);
  assert.deepEqual(D.parseViewerQuery(`?id=${ID}&resourcekey=a<b`), { file: { id: ID }, name: '' });
});

test('isHtmlName', () => {
  for (const ok of ['index.html', 'INDEX.HTM', 'a.b.html', 'page.xhtml', 'x.shtml', ' report.html ', 'レポート.html']) {
    assert.equal(D.isHtmlName(ok), true, ok);
  }
  for (const no of ['index.html.txt', 'html', '.htmlx', 'a.md', '', null, 3, 'index.htm l']) {
    assert.equal(D.isHtmlName(no), false, String(no));
  }
});

test('isHtmlMime', () => {
  assert.equal(D.isHtmlMime('text/html'), true);
  assert.equal(D.isHtmlMime('Text/HTML; charset=Shift_JIS'), true);
  assert.equal(D.isHtmlMime('application/xhtml+xml'), true);
  assert.equal(D.isHtmlMime('text/plain'), false);
  assert.equal(D.isHtmlMime(undefined), false);
});

test('filenameFromDisposition', () => {
  assert.equal(D.filenameFromDisposition('attachment; filename="index.html"'), 'index.html');
  assert.equal(D.filenameFromDisposition('attachment; filename=index.html'), 'index.html');
  assert.equal(
    D.filenameFromDisposition(`attachment; filename="x.html"; filename*=UTF-8''%E3%83%AC%E3%83%9D%E3%83%BC%E3%83%88.html`),
    'レポート.html'
  );
  assert.equal(D.filenameFromDisposition('attachment; filename="a \\"quoted\\" name.html"'), 'a "quoted" name.html');
  assert.equal(D.filenameFromDisposition(`attachment; filename*=UTF-8''%E0%A4%A`), '');
  assert.equal(D.filenameFromDisposition('attachment'), '');
  assert.equal(D.filenameFromDisposition(null), '');
});

test('nameFromDriveTitle', () => {
  assert.equal(D.nameFromDriveTitle('article.html - Google ドライブ'), 'article.html');
  assert.equal(D.nameFromDriveTitle('report - final.html - Google Drive'), 'report - final.html');
  assert.equal(D.nameFromDriveTitle('index.html'), 'index.html');
  assert.equal(D.nameFromDriveTitle(''), '');
  assert.equal(D.nameFromDriveTitle(undefined), '');
});
