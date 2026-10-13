// Runs inside the manifest sandbox (opaque origin, no extension APIs).
// Receives the document from the viewer once and replaces itself with it.
(function () {
  'use strict';

  const linkAction = globalThis.HtmlDoc.linkAction;
  let rendered = false;

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    const anchor = event.target && event.target.closest ? event.target.closest('a[href], area[href]') : null;
    if (!anchor) return;
    const action = linkAction(anchor.getAttribute('href'), anchor.href, location.href);
    if (action === 'default') return;
    event.preventDefault();
    if (action === 'open') window.open(anchor.href, '_blank', 'noopener');
  }

  window.addEventListener('message', (event) => {
    if (rendered || event.source !== window.parent) return;
    const data = event.data;
    if (!data || data.type !== 'render' || typeof data.html !== 'string') return;
    rendered = true;
    document.open();
    document.write(data.html);
    document.close();
    document.addEventListener('click', onClick);
  });

  window.parent.postMessage({ type: 'sandbox-ready' }, '*');
})();
