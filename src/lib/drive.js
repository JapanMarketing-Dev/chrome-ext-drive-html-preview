// Pure helpers shared by the content script, the service worker and the viewer.
// Loaded as a classic script (globalThis.DriveHtml) and as CommonJS in tests.
(function (root) {
  'use strict';

  const ID_RE = /^[-\w]{10,}$/;
  const HTML_EXT_RE = /\.(?:html?|xhtml|shtml)$/i;
  const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com', 'drive.usercontent.google.com']);

  function isValidId(id) {
    return typeof id === 'string' && ID_RE.test(id);
  }

  // Extracts { id, resourceKey, authuser } from any Drive file URL, or returns null.
  function parseDriveUrl(input) {
    if (typeof input !== 'string' || !input.trim()) return null;
    let url;
    try {
      url = new URL(input.trim());
    } catch (_) {
      return null;
    }
    if (url.protocol !== 'https:' || !DRIVE_HOSTS.has(url.hostname)) return null;

    let id = null;
    const m = url.pathname.match(/\/file(?:\/u\/\d+)?\/d\/([-\w]+)/);
    if (m) id = m[1];
    if (!id && /^\/(?:open|uc|download|thumbnail)$/.test(url.pathname)) id = url.searchParams.get('id');
    if (!isValidId(id)) return null;

    const result = { id };
    const resourceKey = url.searchParams.get('resourcekey');
    if (resourceKey && /^[-\w]+$/.test(resourceKey)) result.resourceKey = resourceKey;
    const authuser = authuserFromUrl(url);
    if (authuser !== null) result.authuser = authuser;
    return result;
  }

  // Reads the signed-in account index from /u/N/ paths or ?authuser=N.
  function authuserFromUrl(urlLike) {
    let url;
    try {
      url = typeof urlLike === 'string' ? new URL(urlLike) : urlLike;
    } catch (_) {
      return null;
    }
    const m = url.pathname.match(/\/u\/(\d{1,2})(?:\/|$)/);
    if (m) return m[1];
    const q = url.searchParams.get('authuser');
    if (q !== null && /^(?:\d{1,2}|[^@\s]+@[^@\s]+)$/.test(q)) return q;
    return null;
  }

  function buildDownloadUrl(file) {
    if (!file || !isValidId(file.id)) throw new Error('invalid file id');
    const url = new URL('https://drive.google.com/uc');
    url.searchParams.set('export', 'download');
    url.searchParams.set('id', file.id);
    if (file.resourceKey) url.searchParams.set('resourcekey', file.resourceKey);
    if (file.authuser != null && file.authuser !== '') url.searchParams.set('authuser', String(file.authuser));
    return url.toString();
  }

  function buildDriveViewUrl(file) {
    if (!file || !isValidId(file.id)) throw new Error('invalid file id');
    const url = new URL(`https://drive.google.com/file/d/${file.id}/view`);
    if (file.resourceKey) url.searchParams.set('resourcekey', file.resourceKey);
    if (file.authuser != null && file.authuser !== '') url.searchParams.set('authuser', String(file.authuser));
    return url.toString();
  }

  function buildViewerQuery(file, name) {
    const params = new URLSearchParams();
    params.set('id', file.id);
    if (file.resourceKey) params.set('resourcekey', file.resourceKey);
    if (file.authuser != null && file.authuser !== '') params.set('authuser', String(file.authuser));
    if (name) params.set('name', String(name).slice(0, 255));
    return params.toString();
  }

  function parseViewerQuery(search) {
    const params = new URLSearchParams(search || '');
    const id = params.get('id');
    if (!isValidId(id)) return null;
    const file = { id };
    const rk = params.get('resourcekey');
    if (rk && /^[-\w]+$/.test(rk)) file.resourceKey = rk;
    const au = params.get('authuser');
    if (au !== null && au !== '') file.authuser = au;
    const name = params.get('name');
    return { file, name: name || '' };
  }

  function isHtmlName(name) {
    return typeof name === 'string' && HTML_EXT_RE.test(name.trim());
  }

  function isHtmlMime(mime) {
    if (typeof mime !== 'string') return false;
    const base = mime.split(';')[0].trim().toLowerCase();
    return base === 'text/html' || base === 'application/xhtml+xml';
  }

  // Decodes a filename from a Content-Disposition header (RFC 6266 / 5987).
  function filenameFromDisposition(header) {
    if (typeof header !== 'string') return '';
    const star = header.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
    if (star) {
      try {
        return decodeURIComponent(star[2].trim().replace(/^"|"$/g, ''));
      } catch (_) {
        /* fall through */
      }
    }
    const plain = header.match(/filename\s*=\s*("((?:\\.|[^"\\])*)"|[^;]+)/i);
    if (plain) return (plain[2] !== undefined ? plain[2].replace(/\\(.)/g, '$1') : plain[1]).trim();
    return '';
  }

  // Strips Drive's " - Google ドライブ" style suffix from a tab title.
  function nameFromDriveTitle(title) {
    if (typeof title !== 'string') return '';
    return title.replace(/\s+[-–—]\s+Google\s+\S+\s*$/u, '').trim();
  }

  const api = {
    isValidId,
    parseDriveUrl,
    authuserFromUrl,
    buildDownloadUrl,
    buildDriveViewUrl,
    buildViewerQuery,
    parseViewerQuery,
    isHtmlName,
    isHtmlMime,
    filenameFromDisposition,
    nameFromDriveTitle,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DriveHtml = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
