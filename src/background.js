// Service worker: opens the viewer from the toolbar button, the in-page button and
// the link context menu.
importScripts('lib/drive.js');

const D = globalThis.DriveHtml;
const MENU_ID = 'preview-drive-link';
const LINK_PATTERNS = [
  'https://drive.google.com/file/*',
  'https://drive.google.com/open?*',
  'https://drive.google.com/uc?*',
  'https://docs.google.com/file/*',
  'https://drive.usercontent.google.com/*',
];

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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: chrome.i18n.getMessage('contextMenuTitle'),
      contexts: ['link'],
      targetUrlPatterns: LINK_PATTERNS,
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  const file = D.parseDriveUrl(info.linkUrl);
  openViewer(file, '', tab);
});

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

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== 'open-preview') return;
  if (!sender.tab || !message.file || !D.isValidId(message.file.id)) return;
  const file = { id: message.file.id };
  if (message.file.resourceKey) file.resourceKey = message.file.resourceKey;
  if (message.file.authuser != null) file.authuser = message.file.authuser;
  openViewer(file, typeof message.name === 'string' ? message.name : '', sender.tab);
});
