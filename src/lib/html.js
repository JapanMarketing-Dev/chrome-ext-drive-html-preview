// Byte decoding and link handling for previewed documents.
// Loaded as a classic script (globalThis.HtmlDoc) and as CommonJS in tests.
(function (root) {
  'use strict';

  const PRESCAN_BYTES = 4096;
  const MAX_BYTES = 50 * 1024 * 1024;

  function isSupportedLabel(label) {
    if (typeof label !== 'string' || !label.trim()) return false;
    try {
      new TextDecoder(label.trim());
      return true;
    } catch (_) {
      return false;
    }
  }

  function canonical(label) {
    return new TextDecoder(label.trim()).encoding;
  }

  function bomCharset(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
    return null;
  }

  function charsetFromContentType(contentType) {
    if (typeof contentType !== 'string') return null;
    const m = contentType.match(/charset\s*=\s*["']?([^"';\s]+)/i);
    return m && isSupportedLabel(m[1]) ? canonical(m[1]) : null;
  }

  // Looks for <meta charset> / <meta http-equiv content="...charset=..."> in the first bytes.
  function charsetFromMeta(bytes) {
    const head = new TextDecoder('windows-1252').decode(bytes.subarray(0, PRESCAN_BYTES));
    const withoutComments = head.replace(/<!--[\s\S]*?-->/g, '');
    const metaRe = /<meta\b[^>]*>/gi;
    let m;
    while ((m = metaRe.exec(withoutComments))) {
      const tag = m[0];
      const direct = tag.match(/\bcharset\s*=\s*["']?\s*([^"'\s/>;]+)/i);
      if (direct && isSupportedLabel(direct[1])) {
        const enc = canonical(direct[1]);
        // A UTF-16 declaration inside an ASCII-compatible byte stream means UTF-8 (HTML spec).
        return enc.startsWith('utf-16') ? 'utf-8' : enc;
      }
    }
    return null;
  }

  function isValidUtf8(bytes) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Picks the encoding like a browser would, with a Shift_JIS fallback for invalid UTF-8.
  function detectCharset(bytes, contentType) {
    return (
      bomCharset(bytes) ||
      charsetFromContentType(contentType) ||
      charsetFromMeta(bytes) ||
      (isValidUtf8(bytes) ? 'utf-8' : 'shift_jis')
    );
  }

  function decodeHtml(input, contentType) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length > MAX_BYTES) {
      const err = new Error('too large');
      err.code = 'too_large';
      throw err;
    }
    const charset = detectCharset(bytes, contentType);
    // TextDecoder strips a matching BOM itself.
    const text = new TextDecoder(charset).decode(bytes);
    return { text, charset };
  }

  // Google returns its own HTML pages (sign-in, errors, quota) instead of the file when
  // access fails. Real downloads carry Content-Disposition: attachment and are served
  // from drive.usercontent.google.com; pages served from anywhere else are Google's own.
  function classifyDownload({ ok, status, finalUrl, disposition }) {
    if (status === 401 || status === 403) return 'no_access';
    if (status === 404) return 'not_found';
    if (status === 429) return 'rate_limited';
    if (!ok) return 'http_error';
    let host = '';
    try {
      host = new URL(finalUrl).hostname;
    } catch (_) {
      /* keep empty */
    }
    if (host === 'accounts.google.com') return 'signed_out';
    if (disposition && /attachment/i.test(disposition)) return 'ok';
    if (host === 'drive.usercontent.google.com') return 'ok';
    return 'no_access';
  }

  // Decides what a click on a link inside the preview should do.
  // Returns 'default' (let the browser handle it), 'open' (new tab) or 'block'.
  function linkAction(rawHref, resolvedHref, documentUrl) {
    if (rawHref == null) return 'default';
    const href = String(rawHref).trim();
    if (href === '' || href.startsWith('#')) return 'default';
    if (/^javascript:/i.test(href)) return 'default';
    let resolved;
    try {
      resolved = new URL(resolvedHref);
    } catch (_) {
      return 'block';
    }
    if (documentUrl) {
      try {
        const doc = new URL(documentUrl);
        if (resolved.origin === doc.origin && resolved.pathname === doc.pathname && resolved.search === doc.search) {
          return 'default';
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (/^(?:https?|mailto|tel):$/.test(resolved.protocol)) return 'open';
    // Relative links point at sibling files that only exist in Drive; nothing to open.
    return 'block';
  }

  const api = {
    MAX_BYTES,
    isSupportedLabel,
    bomCharset,
    charsetFromContentType,
    charsetFromMeta,
    isValidUtf8,
    detectCharset,
    decodeHtml,
    classifyDownload,
    linkAction,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HtmlDoc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
