(function () {
  'use strict';

  // 清理旧实例（扩展重载后重新注入时）
  if (window.__typetab_messageHandler) {
    try { chrome.runtime.onMessage.removeListener(window.__typetab_messageHandler); } catch (e) {}
  }
  const oldHost = document.getElementById('typetab-spotlight-host');
  if (oldHost) oldHost.remove();

  let spotlightOpen = false;
  let shadowRoot = null;
  let container = null;
  let tabCache = [];
  let selectedIndex = 0;
  let debounceTimer = null;

  // 搜索算法（内联，避免 import 依赖）
  function searchTabs(tabs, query, maxResults = 20) {
    if (!query || !query.trim()) {
      return tabs.slice(0, maxResults);
    }
    const keywords = query.toLowerCase().trim().split(/\s+/);
    const scored = [];
    for (const tab of tabs) {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      let allMatch = true;
      let totalScore = 0;
      for (const keyword of keywords) {
        const titleIndex = title.indexOf(keyword);
        const urlIndex = url.indexOf(keyword);
        if (titleIndex === -1 && urlIndex === -1) {
          allMatch = false;
          break;
        }
        if (titleIndex !== -1) {
          totalScore += 100 - Math.min(titleIndex, 50) - Math.min(title.length, 50);
        } else {
          totalScore += 50 - Math.min(urlIndex, 50);
        }
      }
      if (allMatch) {
        scored.push({ tab, score: totalScore });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxResults).map((item) => item.tab);
  }

  function createSpotlight() {
    if (!container) {
      // 首次创建宿主容器和 Shadow DOM
      container = document.createElement('div');
      container.id = 'typetab-spotlight-host';
      document.body.appendChild(container);
      shadowRoot = container.attachShadow({ mode: 'closed' });
    }

    // 重建 Shadow DOM 内容（Spotlight UI + 所有样式）
    shadowRoot.innerHTML = `
      <style>${getStyles()} ${getDuplicatePromptStyles()}</style>
      <div class="overlay" id="overlay">
        <div class="spotlight">
          <div class="search-box">
            <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" id="search-input" placeholder="搜索已打开的标签页..." autocomplete="off" />
            <kbd class="esc-hint">ESC</kbd>
          </div>
          <div class="results" id="results"></div>
        </div>
      </div>
    `;
  }

  function getStyles() {
    return `
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 15vh;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: left;
        line-height: normal;
        letter-spacing: normal;
        word-spacing: normal;
      }
      .overlay.hidden { display: none; }
      .spotlight {
        background: #1e1e2e;
        border-radius: 12px;
        width: 580px;
        max-height: 480px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
        overflow: hidden;
        animation: slideDown 0.15s ease-out;
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .search-box {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #2e2e3e;
        gap: 10px;
      }
      .search-icon { color: #888; flex-shrink: 0; }
      .search-box input {
        flex: 1;
        background: none;
        border: none;
        outline: none;
        color: #e0e0e0;
        font-size: 16px;
        caret-color: #4285f4;
      }
      .search-box input::placeholder { color: #666; }
      .esc-hint {
        background: #2e2e3e;
        color: #888;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: inherit;
        flex-shrink: 0;
      }
      .results {
        max-height: 380px;
        overflow-y: auto;
        padding: 4px 0;
      }
      .results::-webkit-scrollbar { width: 6px; }
      .results::-webkit-scrollbar-track { background: transparent; }
      .results::-webkit-scrollbar-thumb { background: #3e3e4e; border-radius: 3px; }
      .result-item {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        cursor: pointer;
        gap: 10px;
        transition: background 0.1s;
      }
      .result-item:hover, .result-item.selected {
        background: #2e2e3e;
      }
      .result-item .favicon {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        flex-shrink: 0;
        object-fit: contain;
      }
      .result-item .favicon-fallback {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        flex-shrink: 0;
        background: #3e3e4e;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        color: #888;
      }
      .result-item .info {
        flex: 1;
        overflow: hidden;
      }
      .result-item .title {
        color: #e0e0e0;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .result-item .url {
        color: #666;
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .no-results {
        padding: 24px 16px;
        text-align: center;
        color: #666;
        font-size: 14px;
      }
    `;
  }

  function renderResults(tabs) {
    const resultsEl = shadowRoot.getElementById('results');
    if (tabs.length === 0) {
      resultsEl.innerHTML = '<div class="no-results">没有找到匹配的标签页</div>';
      return;
    }

    resultsEl.innerHTML = tabs.map((tab, index) => `
      <div class="result-item ${index === selectedIndex ? 'selected' : ''}" data-tab-id="${tab.id}" data-index="${index}">
        ${tab.favIconUrl
          ? `<img class="favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="favicon-fallback" style="display:none">&#127760;</div>`
          : '<div class="favicon-fallback">&#127760;</div>'
        }
        <div class="info">
          <div class="title">${escapeHtml(tab.title || '(无标题)')}</div>
          <div class="url">${escapeHtml(tab.url || '')}</div>
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    resultsEl.querySelectorAll('.result-item').forEach((el) => {
      el.addEventListener('click', () => {
        const tabId = parseInt(el.dataset.tabId, 10);
        switchToTab(tabId);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function updateSelection(newIndex, tabs) {
    const items = shadowRoot.querySelectorAll('.result-item');
    if (items.length === 0) return;
    selectedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
    items.forEach((el, i) => {
      el.classList.toggle('selected', i === selectedIndex);
    });
    // 滚动到可见区域
    items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }

  function switchToTab(tabId) {
    chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId });
    closeSpotlight();
  }

  function openSpotlight() {
    if (spotlightOpen) return;
    spotlightOpen = true;

    // 如果 Spotlight DOM 还没创建（可能 container 被 showDuplicatePrompt 先创建了）
    if (!container || !shadowRoot.getElementById('overlay')) {
      createSpotlight();
    }

    const overlay = shadowRoot.getElementById('overlay');
    overlay.classList.remove('hidden');

    const input = shadowRoot.getElementById('search-input');
    input.value = '';
    selectedIndex = 0;

    // 请求 Tab 列表缓存
    chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
      if (response && response.tabs) {
        tabCache = response.tabs;
        renderResults(tabCache);
      }
    });

    // 延迟聚焦，确保 Shadow DOM 渲染完成
    setTimeout(() => input.focus(), 50);

    // 绑定事件
    input.addEventListener('input', handleInput);
    overlay.addEventListener('click', handleOverlayClick);
    input.addEventListener('keydown', handleKeydown);
  }

  function closeSpotlight() {
    if (!spotlightOpen) return;
    spotlightOpen = false;
    tabCache = [];
    selectedIndex = 0;
    clearTimeout(debounceTimer);

    const overlay = shadowRoot.getElementById('overlay');
    overlay.classList.add('hidden');

    const input = shadowRoot.getElementById('search-input');
    input.removeEventListener('input', handleInput);
    overlay.removeEventListener('click', handleOverlayClick);
    input.removeEventListener('keydown', handleKeydown);
  }

  function handleInput(e) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = e.target.value;
      const filtered = searchTabs(tabCache, query);
      selectedIndex = 0;
      renderResults(filtered);
    }, 100);
  }

  function handleKeydown(e) {
    const items = shadowRoot.querySelectorAll('.result-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(selectedIndex + 1, items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(selectedIndex - 1, items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        const tabId = parseInt(items[selectedIndex].dataset.tabId, 10);
        switchToTab(tabId);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSpotlight();
    }
  }

  function handleOverlayClick(e) {
    // 点击遮罩（非 spotlight 区域）关闭
    if (e.target === shadowRoot.getElementById('overlay')) {
      closeSpotlight();
    }
  }

  // 监听来自 Service Worker 的消息
  function messageHandler(message, sender, sendResponse) {
    if (message.type === 'OPEN_SPOTLIGHT') {
      try { openSpotlight(); } catch (err) { console.error('[TypeTab]', err); }
      sendResponse({ success: true });
    } else if (message.type === 'SHOW_DUPLICATE_PROMPT') {
      try { showDuplicatePrompt(message.existingTabId, message.newTabId, message.title); } catch (err) { console.error('[TypeTab]', err); }
      sendResponse({ success: true });
    }
    return true;
  }
  // 存储引用以便重入时清理旧监听器
  window.__typetab_messageHandler = messageHandler;
  chrome.runtime.onMessage.addListener(messageHandler);

  // 重复 Tab 提示条
  function showDuplicatePrompt(existingTabId, newTabId, title) {
    // 如果已有提示条，先移除
    const existingPrompt = shadowRoot?.querySelector('.duplicate-prompt');
    if (existingPrompt) existingPrompt.remove();

    // 创建提示条容器（如果 Shadow DOM 还没创建）
    if (!container) {
      container = document.createElement('div');
      container.id = 'typetab-spotlight-host';
      document.body.appendChild(container);
      shadowRoot = container.attachShadow({ mode: 'closed' });
      shadowRoot.innerHTML = `<style>${getStyles()} ${getDuplicatePromptStyles()}</style>`;
    } else if (!shadowRoot.querySelector('style[data-dup]')) {
      const style = document.createElement('style');
      style.setAttribute('data-dup', '');
      style.textContent = getDuplicatePromptStyles();
      shadowRoot.appendChild(style);
    }

    const prompt = document.createElement('div');
    prompt.className = 'duplicate-prompt';
    prompt.innerHTML = `
      <div class="dup-content">
        <span class="dup-text">"${escapeHtml(title)}" 已在其他标签页中打开</span>
        <div class="dup-actions">
          <button class="dup-btn dup-btn-switch" id="dup-switch">切换</button>
          <button class="dup-btn dup-btn-keep" id="dup-keep">保留</button>
        </div>
      </div>
    `;
    shadowRoot.appendChild(prompt);

    prompt.querySelector('#dup-switch').addEventListener('click', () => {
      chrome.runtime.sendMessage({
        type: 'DUPLICATE_ACTION',
        action: 'switch',
        existingTabId,
        newTabId,
      });
      prompt.remove();
    });

    prompt.querySelector('#dup-keep').addEventListener('click', () => {
      prompt.remove();
    });

    // 10 秒后自动消失
    setTimeout(() => {
      if (prompt.parentNode) prompt.remove();
    }, 10000);
  }

  function getDuplicatePromptStyles() {
    return `
      .duplicate-prompt {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 2147483647;
        background: #1e1e2e;
        border: 1px solid #3e3e4e;
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: slideIn 0.2s ease-out;
        max-width: 400px;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .dup-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .dup-text {
        color: #e0e0e0;
        font-size: 13px;
        flex: 1;
      }
      .dup-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }
      .dup-btn {
        padding: 4px 12px;
        border-radius: 4px;
        border: none;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
      }
      .dup-btn-switch {
        background: #4285f4;
        color: white;
      }
      .dup-btn-switch:hover { background: #3b78e7; }
      .dup-btn-keep {
        background: #3e3e4e;
        color: #e0e0e0;
      }
      .dup-btn-keep:hover { background: #4e4e5e; }
    `;
  }
})();
