// Service worker: the toolbar button opens the current Drive HTML file (or a link
// prompt) in a full-tab viewer.
importScripts('lib/drive.js');

const D = globalThis.DriveHtml;

function viewerUrl(file, name) {
  const base = chrome.runtime.getURL('viewer.html');
  return file ? `${base}?${D.buildViewerQuery(file, name)}` : base;
}

function openViewer(file, name, fromTab) {
  const props = { url: viewerUrl(file, name) };
  if (fromTab) {
    props.index = fromTab.index + 1;
    props.windowId = fromTab.windowId;
    props.openerTabId = fromTab.id;
  }
  return chrome.tabs.create(props);
}

async function askContentScript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'get-current-file' });
  } catch (_) {
    return null;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  let file = null;
  let name = '';
  if (tab.url && tab.url.startsWith('https://drive.google.com/')) {
    const found = await askContentScript(tab.id);
    if (found && found.file) ({ file, name } = found);
  }
  if (!file && tab.url) file = D.parseDriveUrl(tab.url);
  openViewer(file, name, tab);
});
