// Extension page that downloads a Drive file with the user's own session and
// renders it in the sandboxed frame.
(function () {
  'use strict';

  const D = globalThis.DriveHtml;
  const H = globalThis.HtmlDoc;
  const $ = (id) => document.getElementById(id);
  const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;

  const state = { file: null, name: '', html: '', mode: 'rendered', frameListener: null };

  function localize() {
    document.documentElement.lang = chrome.i18n.getUILanguage();
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-title]')) {
      el.title = t(el.dataset.i18nTitle);
      el.setAttribute('aria-label', el.title);
    }
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  }

  function show(id) {
    for (const panel of ['empty', 'loading', 'error', 'frame', 'source']) $(panel).hidden = panel !== id;
  }

  function setTitle(name) {
    $('fileName').textContent = name || t('appName');
    document.title = name ? `${name} – ${t('appName')}` : t('appName');
  }

  function showError(code) {
    const known = ['no_access', 'signed_out', 'not_found', 'rate_limited', 'too_large', 'network', 'http_error'];
    $('errorMessage').textContent = t('error_' + (known.includes(code) ? code : 'http_error'));
    $('errorOpenDrive').href = D.buildDriveViewUrl(state.file);
    $('actions').hidden = true;
    show('error');
  }

  async function download(file) {
    let response;
    try {
      response = await fetch(D.buildDownloadUrl(file), { credentials: 'include', redirect: 'follow', cache: 'no-store' });
    } catch (_) {
      // Signed-out downloads redirect to accounts.google.com, which this extension has no
      // access to, so the fetch fails the same way a dropped connection does.
      return { error: navigator.onLine === false ? 'network' : 'no_access' };
    }
    const verdict = H.classifyDownload({
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      disposition: response.headers.get('content-disposition'),
    });
    if (verdict !== 'ok') return { error: verdict };
    const length = Number(response.headers.get('content-length'));
    if (length > H.MAX_BYTES) return { error: 'too_large' };
    const buffer = await response.arrayBuffer();
    try {
      const { text, charset } = H.decodeHtml(buffer, response.headers.get('content-type'));
      return { text, charset, name: D.filenameFromDisposition(response.headers.get('content-disposition')) };
    } catch (err) {
      return { error: err && err.code === 'too_large' ? 'too_large' : 'http_error' };
    }
  }

  // A fresh sandbox per render: the sandbox page replaces itself with the document.
  function renderInFrame(html) {
    const old = $('frame');
    const frame = document.createElement('iframe');
    frame.id = 'frame';
    frame.title = state.name || 'preview';
    frame.setAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads'
    );
    frame.src = 'sandbox.html';
    old.replaceWith(frame);

    if (state.frameListener) window.removeEventListener('message', state.frameListener);
    state.frameListener = (event) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.type !== 'sandbox-ready') return;
      frame.contentWindow.postMessage({ type: 'render', html }, '*');
    };
    window.addEventListener('message', state.frameListener);
  }

  function setMode(mode) {
    state.mode = mode;
    $('modeRendered').setAttribute('aria-selected', String(mode === 'rendered'));
    $('modeSource').setAttribute('aria-selected', String(mode === 'source'));
    if (mode === 'source') {
      $('source').textContent = state.html;
      show('source');
    } else {
      show('frame');
    }
  }

  async function load() {
    show('loading');
    $('actions').hidden = true;
    $('charset').hidden = true;
    const result = await download(state.file);
    if (result.error) return showError(result.error);

    state.html = result.text;
    if (result.name) state.name = result.name;
    setTitle(state.name);
    $('charset').textContent = result.charset.toUpperCase();
    $('charset').hidden = false;
    $('openDrive').href = D.buildDriveViewUrl(state.file);
    $('actions').hidden = false;
    renderInFrame(state.html);
    setMode(state.mode);
  }

  function openFromInput(event) {
    event.preventDefault();
    const file = D.parseDriveUrl($('urlInput').value);
    if (!file) {
      $('urlError').hidden = false;
      return;
    }
    location.search = '?' + D.buildViewerQuery(file, '');
  }

  function init() {
    localize();
    $('modeRendered').addEventListener('click', () => setMode('rendered'));
    $('modeSource').addEventListener('click', () => setMode('source'));
    $('reload').addEventListener('click', load);
    $('retry').addEventListener('click', load);
    $('urlForm').addEventListener('submit', openFromInput);
    $('urlInput').addEventListener('input', () => ($('urlError').hidden = true));

    const parsed = D.parseViewerQuery(location.search);
    if (!parsed) {
      setTitle('');
      show('empty');
      $('urlInput').focus();
      return;
    }
    state.file = parsed.file;
    state.name = parsed.name;
    setTitle(state.name);
    load();
  }

  init();
})();
