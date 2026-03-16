import { isDuplicate } from '../lib/search.js';

// TypeTab Service Worker
'use strict';

// ===== 快捷键命令处理 =====

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-search') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) return;

    try {
      // 尝试发消息给 Content Script
      await chrome.tabs.sendMessage(activeTab.id, { type: 'OPEN_SPOTLIGHT' });
    } catch (err) {
      // Content Script 未就绪，尝试动态注入
      try {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: activeTab.id },
          files: ['content/content.css']
        });
        // 注入后再次发消息
        await chrome.tabs.sendMessage(activeTab.id, { type: 'OPEN_SPOTLIGHT' });
      } catch (injectErr) {
        // 受限页面，尝试打开 Popup
        try {
          await chrome.action.openPopup();
        } catch (popupErr) {
          // openPopup 不可用，用户需手动点击图标
          console.log('TypeTab: 无法在此页面打开搜索，请点击工具栏图标');
        }
      }
    }
  }
});

// ===== 消息路由 =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TABS') {
    // 返回所有 Tab 列表
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
    return true; // 异步响应
  }

  if (message.type === 'SWITCH_TAB') {
    // 切换到指定 Tab
    chrome.tabs.update(message.tabId, { active: true }).then((tab) => {
      // 同时切换到该 Tab 所在的窗口
      chrome.windows.update(tab.windowId, { focused: true });
    });
    return false;
  }

  if (message.type === 'DUPLICATE_ACTION') {
    // 处理重复 Tab 的用户选择
    if (message.action === 'switch') {
      chrome.tabs.update(message.existingTabId, { active: true }).then((tab) => {
        chrome.windows.update(tab.windowId, { focused: true });
        chrome.tabs.remove(message.newTabId).catch(() => {});
      }).catch(() => {
        // 已有 Tab 可能已关闭，保留新 Tab
      });
    }
    // action === 'keep' 则不做任何处理
    return false;
  }
});

// ===== 重复 Tab 检测 =====

// 记录新创建的 Tab ID
const newTabIds = new Set();

chrome.tabs.onCreated.addListener((tab) => {
  newTabIds.add(tab.id);
});

// 当 Tab 被关闭时，从 Set 中移除
chrome.tabs.onRemoved.addListener((tabId) => {
  newTabIds.delete(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 仅在 URL 变化时检测
  if (!changeInfo.url) return;
  // 仅检测新创建的 Tab
  if (!newTabIds.has(tabId)) return;
  // 检测完成后移除
  newTabIds.delete(tabId);

  // 读取用户设置
  const settings = await chrome.storage.sync.get({
    interceptEnabled: true,
    interceptMode: 'prompt',
    matchRule: 'exact_url',
  });

  if (!settings.interceptEnabled) return;

  // 查找重复 Tab
  const allTabs = await chrome.tabs.query({});
  const newUrl = changeInfo.url;
  let existingTab = null;

  for (const t of allTabs) {
    if (t.id === tabId) continue; // 排除自身
    if (isDuplicate(newUrl, t.url, settings.matchRule)) {
      existingTab = t;
      break;
    }
  }

  if (!existingTab) return;

  // 根据模式处理
  if (settings.interceptMode === 'silent') {
    // 静默模式：先激活已有 Tab，再关闭新 Tab
    try {
      await chrome.tabs.update(existingTab.id, { active: true });
      await chrome.windows.update(existingTab.windowId, { focused: true });
      await chrome.tabs.remove(tabId);
    } catch (err) {
      // 已有 Tab 可能已关闭，放弃拦截
      console.log('TypeTab: 静默切换失败，保留新 Tab', err);
    }
  } else {
    // 提示模式：通知 Content Script 显示提示条
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_DUPLICATE_PROMPT',
        existingTabId: existingTab.id,
        newTabId: tabId,
        title: existingTab.title || existingTab.url,
      });
    } catch (err) {
      // Content Script 未就绪或受限页面，使用系统通知
      chrome.notifications.create(`typetab-dup-${tabId}`, {
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'TypeTab - 重复标签页',
        message: `"${existingTab.title || existingTab.url}" 已在其他标签页中打开`,
        buttons: [{ title: '切换到已有标签页' }],
      });

      // 监听通知按钮点击
      const notifId = `typetab-dup-${tabId}`;
      function onButtonClicked(id, btnIndex) {
        if (id !== notifId) return;
        if (btnIndex === 0) {
          // "切换"按钮
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
});
