// Runs on drive.google.com. When Drive previews an HTML file (which it shows as
// source text), lays the rendered page over Drive's text page, in place.
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

  // The scrollable area that holds Drive's text pages for the file on screen.
  function scrollParent(el) {
    const view = el.ownerDocument.defaultView;
    for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
      const overflow = view.getComputedStyle(p).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return p;
    }
    return null;
  }

  // Drive shows text files as one or more [role=document] pages holding a <pre>.
  // In a folder the pages sit inside the preview overlay's dialog.
  function findSourcePane(doc) {
    const dialog = [...doc.querySelectorAll('[role="dialog"]')].filter(isVisible).find((d) => d.querySelector('[role="document"] pre'));
    const scope = dialog || doc;
    const pages = [...scope.querySelectorAll('[role="document"]')].filter((page) => page.querySelector('pre') && isVisible(page));
    if (!pages.length) return null;
    const scroller = scrollParent(pages[0]);
    if (!scroller) return null;
    return { pages, scroller };
  }

  function sourceText(pane) {
    return pane.pages.map((page) => [...page.querySelectorAll('pre')].map((pre) => pre.textContent).join('')).join('');
  }

  // Leaves room for Drive's previous / next arrows at the sides of the overlay.
  const SIDE_GAP = 72;

  function frameRect(scroller) {
    const r = scroller.getBoundingClientRect();
    const gap = r.width > SIDE_GAP * 2 + 320 ? SIDE_GAP : 0;
    return { left: r.left + gap, top: r.top, width: Math.max(0, r.width - gap * 2), height: r.height };
  }

  function embedUrl(file, name) {
    const base = globalThis.chrome && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('viewer.html') : 'viewer.html';
    return `${base}?embed=1&${D.buildViewerQuery(file, name)}`;
  }

  function ensureEmbed(doc, file, name, rect) {
    let host = doc.getElementById(HOST_ID);
    const src = embedUrl(file, name);
    if (!host) {
      host = doc.createElement('div');
      host.id = HOST_ID;
      const frame = doc.createElement('iframe');
      frame.title = name;
      frame.setAttribute('allow', 'clipboard-write');
      frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#fff;color-scheme:light';
      host.append(frame);
      (doc.body || doc.documentElement).append(host);
    }
    const frame = host.firstElementChild;
    if (frame.getAttribute('src') !== src) {
      frame.setAttribute('src', src);
      frame.title = name;
    }
    const css =
      `position:fixed;z-index:2147483000;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;` +
      'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);';
    // Only touch the style when it changes, so the page observer doesn't loop on our writes.
    if (host.dataset.css !== css) {
      host.dataset.css = css;
      host.style.cssText = css;
    }
    return host;
  }

  function removeEmbed(doc) {
    const host = doc.getElementById(HOST_ID);
    if (host) host.remove();
  }

  function createController(doc, win) {
    let current = null;
    let lastActivatedId = null;
    let timer = null;
    let pane = null;
    let observed = null;
    const resizeObserver = win.ResizeObserver ? new win.ResizeObserver(() => schedule()) : null;

    function refresh() {
      timer = null;
      const next = detectCurrentFile(doc, win.location.href, lastActivatedId, current);
      pane = next ? findSourcePane(doc) : null;
      if (!next || !pane) {
        current = next;
        removeEmbed(doc);
        return;
      }
      current = next;
      ensureEmbed(doc, next.file, next.name, frameRect(pane.scroller));
      if (resizeObserver && observed !== pane.scroller) {
        if (observed) resizeObserver.unobserve(observed);
        observed = pane.scroller;
        resizeObserver.observe(observed);
      }
    }

    function schedule() {
      if (timer === null) timer = win.setTimeout(refresh, 150);
    }

    function track(event) {
      const target = event.target;
      if (!target || !target.closest) return;
      const item = target.closest('[data-id]');
      if (!item) return;
      const id = item.getAttribute('data-id');
      if (D.isValidId(id) && itemNameOf(item)) lastActivatedId = id;
    }

    // The viewer asks for Drive's own copy of the text when it can't download the file.
    function onMessage(event) {
      const host = doc.getElementById(HOST_ID);
      const frame = host && host.firstElementChild;
      if (!frame || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== 'dhp-need-text') return;
      const text = pane ? sourceText(pane) : '';
      let origin = '*';
      try {
        origin = new URL(frame.src).origin;
      } catch (_) {
        /* keep '*' */
      }
      frame.contentWindow.postMessage({ type: 'dhp-text', text }, origin === 'null' ? '*' : origin);
    }

    function start() {
      doc.addEventListener('mousedown', track, true);
      doc.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && track(e), true);
      const ownHost = (node) => node.id === HOST_ID || (node.closest && node.closest('#' + HOST_ID));
      new win.MutationObserver((records) => {
        const ours = (r) =>
          ownHost(r.target) || (r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every((n) => n.id === HOST_ID));
        if (records.every(ours)) return;
        schedule();
      }).observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-hidden', 'style', 'class'],
      });
      win.addEventListener('resize', schedule);
      win.addEventListener('popstate', schedule);
      win.addEventListener('message', onMessage);
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
    SIDE_GAP,
    findOverlayName,
    idsForName,
    itemNameOf,
    detectCurrentFile,
    findSourcePane,
    sourceText,
    frameRect,
    createController,
    ensureEmbed,
    removeEmbed,
  };

  if (isNode) {
    module.exports = core;
    return;
  }

  if (window.top !== window) return;
  const controller = createController(document, window);
  controller.start();
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'get-current-file') {
      controller.refresh();
      const found = controller.getCurrent();
      sendResponse(found ? { file: found.file, name: found.name } : null);
    }
  });
})();
