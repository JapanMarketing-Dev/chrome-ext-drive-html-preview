// Runs on drive.google.com. Finds the HTML file being viewed and offers a button
// that opens it rendered in the extension's viewer.
(function () {
  'use strict';

  const isNode = typeof module === 'object' && module.exports;
  const D = isNode ? require('./lib/drive.js') : globalThis.DriveHtml;

  const HOST_ID = 'drive-html-preview-host';
  const MAX_NAME_LEN = 255;

  function ownText(el) {
    return (el.textContent || '').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const view = el.ownerDocument.defaultView;
    const style = view && view.getComputedStyle ? view.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    return true;
  }

  function isHiddenLeaf(node) {
    return !!node.closest('[aria-hidden="true"], [role="tooltip"]');
  }

  // The file name shown in an open preview overlay, if it is an HTML file.
  // Drive renders the overlay as its own top-level container: a [role=dialog] for the
  // viewer plus a header whose rename button is labelled with the file name.
  function findOverlayName(doc) {
    const dialogs = [...doc.querySelectorAll('[role="dialog"]')].filter(isVisible);
    for (const dialog of dialogs) {
      const container = dialog.closest('body > *') || dialog;
      if (container.querySelector('[role="grid"], tr[data-id]')) continue;
      for (const node of container.querySelectorAll('*')) {
        if (node.children.length > 0) continue;
        const text = ownText(node);
        if (text.length > MAX_NAME_LEN || !D.isHtmlName(text) || isHiddenLeaf(node)) continue;
        const labelled = node.parentElement && node.parentElement.closest('[aria-label]');
        if (labelled && container.contains(labelled) && labelled.getAttribute('aria-label').includes(text)) return text;
      }
    }
    return null;
  }

  // All list/grid items Drive renders for files, keyed by their data-id.
  function fileItems(doc) {
    const items = new Map();
    for (const el of doc.querySelectorAll('[data-id]')) {
      const id = el.getAttribute('data-id');
      if (!D.isValidId(id) || items.has(id)) continue;
      items.set(id, el);
    }
    return items;
  }

  function itemHasName(el, name) {
    if (el.getAttribute('aria-label') === name || el.getAttribute('data-tooltip') === name) return true;
    for (const node of el.querySelectorAll('*')) {
      if (node.children.length === 0 && ownText(node) === name) return true;
    }
    return false;
  }

  function idsForName(doc, name) {
    const ids = [];
    for (const [id, el] of fileItems(doc)) if (itemHasName(el, name)) ids.push(id);
    return ids;
  }

  function itemNameOf(el) {
    for (const node of el.querySelectorAll('*')) {
      if (node.children.length === 0) {
        const text = ownText(node);
        if (text.length <= MAX_NAME_LEN && D.isHtmlName(text)) return text;
      }
    }
    return null;
  }

  // Works out which HTML file is on screen. `lastActivatedId` is the item the user
  // last clicked or opened, used to tell apart files that share a name.
  // `previous` lets a still-open overlay skip the item scan on every DOM change.
  function detectCurrentFile(doc, href, lastActivatedId, previous) {
    const fromUrl = D.parseDriveUrl(href);
    if (fromUrl && /\/file\/(?:u\/\d+\/)?d\//.test(new URL(href).pathname)) {
      const name = D.nameFromDriveTitle(doc.title);
      if (!D.isHtmlName(name)) return null;
      return { file: fromUrl, name };
    }

    const name = findOverlayName(doc);
    if (!name) return null;
    if (previous && previous.name === name && previous.activatedId === lastActivatedId) return previous;
    const ids = idsForName(doc, name);
    let id = null;
    if (lastActivatedId && ids.includes(lastActivatedId)) id = lastActivatedId;
    else if (ids.length === 1) id = ids[0];
    if (!id) return null;

    const file = { id };
    const authuser = D.authuserFromUrl(href);
    if (authuser !== null) file.authuser = authuser;
    return { file, name, activatedId: lastActivatedId };
  }

  function label(key, fallback) {
    try {
      return (globalThis.chrome && chrome.i18n && chrome.i18n.getMessage(key)) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  const BUTTON_CSS = `
    :host { all: initial; }
    button {
      position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
      display: inline-flex; align-items: center; gap: 10px;
      padding: 12px 18px 12px 14px; border: 0; border-radius: 999px;
      background: #D2441F; color: #fff; cursor: pointer;
      font: 600 14px/1.2 "Google Sans", Roboto, "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
      letter-spacing: .01em;
      box-shadow: 0 6px 20px rgba(227, 79, 38, .35), 0 2px 6px rgba(0, 0, 0, .25);
      transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
    }
    button:hover { background: #B5361A; transform: translateY(-1px); box-shadow: 0 10px 26px rgba(227, 79, 38, .42), 0 3px 8px rgba(0, 0, 0, .25); }
    button:active { transform: translateY(0); }
    button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
    svg { width: 20px; height: 20px; flex: none; }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
  `;

  const BUTTON_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M8 7l-5 5 5 5M16 7l5 5-5 5"/><path fill="currentColor" d="M10.5 9.2v5.6c0 .5.5.8.9.5l4.3-2.8c.4-.2.4-.8 0-1l-4.3-2.8c-.4-.3-.9 0-.9.5z"/></svg>';

  function ensureButton(doc, onClick) {
    let host = doc.getElementById(HOST_ID);
    if (host) return host;
    host = doc.createElement('div');
    host.id = HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = BUTTON_CSS;
    const button = doc.createElement('button');
    button.type = 'button';
    button.innerHTML = BUTTON_ICON;
    const text = doc.createElement('span');
    text.textContent = label('previewButton', 'Preview as web page');
    button.append(text);
    button.title = label('previewButtonTitle', 'Render this HTML file in a new tab');
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    shadow.append(style, button);
    (doc.body || doc.documentElement).append(host);
    return host;
  }

  function removeButton(doc) {
    const host = doc.getElementById(HOST_ID);
    if (host) host.remove();
  }

  function createController(doc, win, send) {
    let current = null;
    let lastActivatedId = null;
    let timer = null;

    function openCurrent() {
      if (!current) return;
      send({ type: 'open-preview', file: current.file, name: current.name });
    }

    function refresh() {
      timer = null;
      const next = detectCurrentFile(doc, win.location.href, lastActivatedId, current);
      if (!next) {
        current = null;
        removeButton(doc);
        return;
      }
      current = next;
      ensureButton(doc, openCurrent);
    }

    function schedule() {
      if (timer === null) timer = win.setTimeout(refresh, 250);
    }

    function track(event) {
      const target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('#' + HOST_ID)) return;
      const item = target.closest('[data-id]');
      if (!item) return;
      const id = item.getAttribute('data-id');
      if (D.isValidId(id) && itemNameOf(item)) lastActivatedId = id;
    }

    function start() {
      doc.addEventListener('mousedown', track, true);
      doc.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && track(e), true);
      new win.MutationObserver(schedule).observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-hidden', 'style', 'class'],
      });
      win.addEventListener('popstate', schedule);
      refresh();
    }

    return {
      start,
      refresh,
      getCurrent: () => current,
      setLastActivated: (id) => (lastActivatedId = id),
    };
  }

  const core = {
    HOST_ID,
    findOverlayName,
    idsForName,
    itemNameOf,
    detectCurrentFile,
    createController,
    ensureButton,
    removeButton,
  };

  if (isNode) {
    module.exports = core;
    return;
  }

  if (window.top !== window) return;
  const controller = createController(document, window, (message) => {
    chrome.runtime.sendMessage(message).catch(() => {});
  });
  controller.start();
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'get-current-file') {
      controller.refresh();
      const found = controller.getCurrent();
      sendResponse(found ? { file: found.file, name: found.name } : null);
    }
  });
})();
