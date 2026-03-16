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
