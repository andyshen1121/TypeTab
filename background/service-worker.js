import { isDuplicate } from '../lib/search.js';

// TypeTab Service Worker
'use strict';

// ===== 扩展安装/重载时，向已有页面注入 Content Script =====

chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') ||
        tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/content.css'] });
    } catch (e) {
      // 某些页面可能无法注入，忽略
    }
  }
});

// ===== 快捷键命令处理 =====

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-search') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'OPEN_SPOTLIGHT' });
    } catch (err) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['content/content.css']
        });
        await chrome.tabs.sendMessage(activeTab.id, { type: 'OPEN_SPOTLIGHT' });
      } catch (injectErr) {
        try {
          await chrome.action.openPopup();
        } catch (popupErr) {
          console.log('TypeTab: 无法在此页面打开搜索');
        }
      }
    }
  }
});

// ===== 消息路由 =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TABS') {
    chrome.tabs.query({}).then((tabs) => {
      const tabData = tabs.map((tab) => ({
        id: tab.id,
        title: tab.title || '',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl || '',
        windowId: tab.windowId,
      }));
      sendResponse({ tabs: tabData });
    });
    return true;
  }

  if (message.type === 'SWITCH_TAB') {
    chrome.tabs.update(message.tabId, { active: true }).then((tab) => {
      chrome.windows.update(tab.windowId, { focused: true });
    }).catch(() => {});
    return false;
  }

  if (message.type === 'CLOSE_TAB') {
    chrome.tabs.remove(message.tabId).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'DUPLICATE_ACTION') {
    if (message.action === 'switch') {
      chrome.tabs.update(message.existingTabId, { active: true }).then((tab) => {
        chrome.windows.update(tab.windowId, { focused: true });
        chrome.tabs.remove(message.newTabId).catch(() => {});
      }).catch(() => {});
    }
    return false;
  }
});

// ===== 重复 Tab 检测 =====

function isInternalUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://');
}

// 记录新建的标签页 ID（只有新建标签才做重复检测）
const newlyCreatedTabs = new Set();
// 提示模式下，Content Script 未就绪时暂存的重复信息
const pendingPrompts = new Map();

// 启动时无需初始化——仅拦截新打开的标签页
const initPromise = Promise.resolve();

// 发送重复提示到 Content Script，失败则回退到系统通知
async function sendDuplicatePrompt(tabId, existingTab) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_DUPLICATE_PROMPT',
      existingTabId: existingTab.id,
      newTabId: tabId,
      title: existingTab.title || existingTab.url,
    });
  } catch (err) {
    // Content Script 不可用，使用系统通知
    chrome.notifications.create(`typetab-dup-${tabId}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'TypeTab - 重复标签页',
      message: `"${existingTab.title || existingTab.url}" 已在其他标签页中打开`,
      buttons: [{ title: '切换到已有标签页' }],
    });

    const notifId = `typetab-dup-${tabId}`;
    function onButtonClicked(id, btnIndex) {
      if (id !== notifId) return;
      if (btnIndex === 0) {
        chrome.tabs.update(existingTab.id, { active: true }).then((t) => {
          chrome.windows.update(t.windowId, { focused: true });
          chrome.tabs.remove(tabId).catch(() => {});
        }).catch(() => {});
      }
      cleanup();
    }
    function onClosed(id) {
      if (id !== notifId) return;
      cleanup();
    }
    function cleanup() {
      chrome.notifications.onButtonClicked.removeListener(onButtonClicked);
      chrome.notifications.onClosed.removeListener(onClosed);
    }
    chrome.notifications.onButtonClicked.addListener(onButtonClicked);
    chrome.notifications.onClosed.addListener(onClosed);
  }
}

// 监听新建标签页事件
chrome.tabs.onCreated.addListener((tab) => {
  newlyCreatedTabs.add(tab.id);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // ── URL 变化时：立即检测重复（仅限新建标签页）──
  if (changeInfo.url && !isInternalUrl(changeInfo.url)) {
    // 非新建标签页的导航（如同域内页面跳转）不做拦截
    if (!newlyCreatedTabs.has(tabId)) return;
    // 检测过一次后移除，防止同一标签后续导航再触发
    newlyCreatedTabs.delete(tabId);

    await initPromise;

    const settings = await chrome.storage.sync.get({
      interceptEnabled: true,
      interceptMode: 'prompt',
      matchRule: 'exact_url',
    });
    if (!settings.interceptEnabled) return;

    // 查找重复 Tab
    const allTabs = await chrome.tabs.query({});
    let existingTab = null;
    for (const t of allTabs) {
      if (t.id === tabId) continue;
      if (isDuplicate(changeInfo.url, t.url, settings.matchRule)) {
        existingTab = t;
        break;
      }
    }
    if (!existingTab) return;

    if (settings.interceptMode === 'silent') {
      // 静默模式：立即切换，无需等待页面加载
      try {
        await chrome.tabs.update(existingTab.id, { active: true });
        await chrome.windows.update(existingTab.windowId, { focused: true });
        await chrome.tabs.remove(tabId);
      } catch (err) {
        // 已有 Tab 可能已关闭
      }
    } else {
      // 提示模式：尝试立即发送，Content Script 可能已从 manifest 注入
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'SHOW_DUPLICATE_PROMPT',
          existingTabId: existingTab.id,
          newTabId: tabId,
          title: existingTab.title || existingTab.url,
        });
      } catch (err) {
        // Content Script 未就绪，暂存等待 status: complete
        pendingPrompts.set(tabId, existingTab);
      }
    }
  }

  // ── 页面加载完成：重试暂存的提示 ──
  if (changeInfo.status === 'complete' && pendingPrompts.has(tabId)) {
    const existingTab = pendingPrompts.get(tabId);
    pendingPrompts.delete(tabId);
    await sendDuplicatePrompt(tabId, existingTab);
  }
});

// Tab 关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  newlyCreatedTabs.delete(tabId);
  pendingPrompts.delete(tabId);
});
