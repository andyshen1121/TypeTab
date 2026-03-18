'use strict';

// ===== 主题功能 =====

function resolveTheme(setting) {
  if (setting === 'light' || setting === 'dark') return setting;
  // system 或其他值，跟随系统
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(themeSetting) {
  document.documentElement.setAttribute('data-theme', resolveTheme(themeSetting));
}

// 监听系统主题变化，当设置为 system 时自动切换
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  chrome.storage.sync.get({ theme: 'system' }, (settings) => {
    if (settings.theme === 'system') {
      applyTheme('system');
    }
  });
});

// ===== Tab 切换 =====

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      // 切换按钮状态
      tabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      // 切换内容
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
      // 切换到搜索页时聚焦输入框
      if (tabName === 'search') {
        document.getElementById('search-input').focus();
      }
    });
  });
}

// ===== 搜索功能 =====

let tabCache = [];
let selectedIndex = 0;
let debounceTimer = null;

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderResults(tabs) {
  const resultsEl = document.getElementById('results');
  if (tabs.length === 0) {
    resultsEl.innerHTML = '<div class="no-results">没有找到匹配的标签页</div>';
    return;
  }
  resultsEl.innerHTML = tabs.map((tab, index) => `
    <div class="result-item ${index === selectedIndex ? 'selected' : ''}" data-tab-id="${tab.id}" data-index="${index}">
      ${tab.favIconUrl
        ? `<img class="favicon" src="${escapeHtml(tab.favIconUrl)}"><div class="favicon-fallback" style="display:none">&#127760;</div>`
        : '<div class="favicon-fallback">&#127760;</div>'
      }
      <div class="info">
        <div class="title">${escapeHtml(tab.title || '(无标题)')}</div>
        <div class="url">${escapeHtml(tab.url || '')}</div>
      </div>
      <button class="close-btn" data-tab-id="${tab.id}" title="关闭标签页">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  // 绑定 favicon 加载失败降级
  resultsEl.querySelectorAll('.favicon').forEach((img) => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      img.nextElementSibling.style.display = 'flex';
    });
  });

  // 绑定点击切换标签页事件
  resultsEl.querySelectorAll('.result-item').forEach((el) => {
    el.addEventListener('click', () => {
      switchToTab(parseInt(el.dataset.tabId, 10));
    });
  });

  // 绑定关闭按钮事件
  resultsEl.querySelectorAll('.close-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(parseInt(btn.dataset.tabId, 10));
    });
  });
}

function closeTab(tabId) {
  chrome.tabs.remove(tabId, () => {
    // 从缓存中移除
    tabCache = tabCache.filter((t) => t.id !== tabId);
    // 重新过滤并渲染
    const query = document.getElementById('search-input').value;
    const filtered = searchTabs(tabCache, query);
    selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
    renderResults(filtered);
  });
}

function switchToTab(tabId) {
  chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId });
  window.close();
}

function updateSelection(newIndex) {
  const items = document.querySelectorAll('.result-item');
  if (items.length === 0) return;
  selectedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
  items.forEach((el, i) => el.classList.toggle('selected', i === selectedIndex));
  items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

function initSearch() {
  const input = document.getElementById('search-input');

  // 加载 Tab 列表
  chrome.runtime.sendMessage({ type: 'GET_TABS' }, (response) => {
    if (response && response.tabs) {
      tabCache = response.tabs;
      renderResults(tabCache);
    }
  });

  input.focus();

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const filtered = searchTabs(tabCache, e.target.value);
      selectedIndex = 0;
      renderResults(filtered);
    }, 100);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const items = document.querySelectorAll('.result-item');
      if (items[selectedIndex]) {
        switchToTab(parseInt(items[selectedIndex].dataset.tabId, 10));
      }
    } else if (e.key === 'Escape') {
      window.close();
    } else if (matchesShortcut(e, closeTabShortcut)) {
      e.preventDefault();
      const items = document.querySelectorAll('.result-item');
      if (items[selectedIndex]) {
        closeTab(parseInt(items[selectedIndex].dataset.tabId, 10));
      }
    }
  });
}

// ===== 设置功能 =====

const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  interceptMode: 'prompt',
  matchRule: 'exact_url',
  theme: 'system',
  closeTabShortcut: 'ctrl+backspace',
};

let closeTabShortcut = 'ctrl+backspace';

// 匹配快捷键
function matchesShortcut(e, shortcut) {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();
  const mods = new Set(parts);
  if (e.key.toLowerCase() !== key) return false;
  if ((e.ctrlKey || e.metaKey) !== mods.has('ctrl')) return false;
  if (e.shiftKey !== mods.has('shift')) return false;
  if (e.altKey !== mods.has('alt')) return false;
  return true;
}

// 录制快捷键（keydown 事件 -> 字符串，修饰键单独按返回 null）
function recordShortcut(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  if (parts.length === 0) return null; // 要求至少一个修饰键
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

// 显示快捷键（平台感知）
function formatShortcut(shortcut) {
  const isMac = navigator.platform.includes('Mac');
  return shortcut.split('+').map((p) => {
    if (p === 'ctrl') return isMac ? 'Cmd' : 'Ctrl';
    if (p === 'alt') return isMac ? 'Option' : 'Alt';
    if (p === 'shift') return 'Shift';
    return p.charAt(0).toUpperCase() + p.slice(1);
  }).join(' + ');
}

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById('interceptEnabled').checked = settings.interceptEnabled;
    document.getElementById('interceptMode').value = settings.interceptMode;
    document.getElementById('matchRule').value = settings.matchRule;
    document.getElementById('themeMode').value = settings.theme;
    applyTheme(settings.theme);
    closeTabShortcut = settings.closeTabShortcut;
    document.getElementById('closeTabShortcut').textContent = formatShortcut(settings.closeTabShortcut);
  });
}

function saveSettings() {
  const settings = {
    interceptEnabled: document.getElementById('interceptEnabled').checked,
    interceptMode: document.getElementById('interceptMode').value,
    matchRule: document.getElementById('matchRule').value,
    theme: document.getElementById('themeMode').value,
    closeTabShortcut,
  };
  chrome.storage.sync.set(settings, () => {
    showToast();
  });
}

function showToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1200);
}

function initSettings() {
  loadSettings();

  document.getElementById('interceptEnabled').addEventListener('change', saveSettings);
  document.getElementById('interceptMode').addEventListener('change', saveSettings);
  document.getElementById('matchRule').addEventListener('change', saveSettings);

  // 主题切换
  document.getElementById('themeMode').addEventListener('change', () => {
    const themeSetting = document.getElementById('themeMode').value;
    applyTheme(themeSetting);
    saveSettings();
  });

  document.getElementById('shortcut-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // 快捷键录制器
  const closeTabShortcutBtn = document.getElementById('closeTabShortcut');
  closeTabShortcutBtn.addEventListener('click', () => {
    closeTabShortcutBtn.textContent = '请按下快捷键...';
    closeTabShortcutBtn.classList.add('recording');

    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        cancel();
        return;
      }
      const shortcut = recordShortcut(e);
      if (!shortcut) return;
      closeTabShortcut = shortcut;
      closeTabShortcutBtn.textContent = formatShortcut(shortcut);
      closeTabShortcutBtn.classList.remove('recording');
      document.removeEventListener('keydown', onKey, true);
      closeTabShortcutBtn.removeEventListener('blur', onBlur);
      chrome.storage.sync.set({ closeTabShortcut: shortcut });
    }

    function onBlur() {
      cancel();
    }

    function cancel() {
      closeTabShortcutBtn.textContent = formatShortcut(closeTabShortcut);
      closeTabShortcutBtn.classList.remove('recording');
      document.removeEventListener('keydown', onKey, true);
      closeTabShortcutBtn.removeEventListener('blur', onBlur);
    }

    document.addEventListener('keydown', onKey, true);
    closeTabShortcutBtn.addEventListener('blur', onBlur);
  });
}

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  // 尽早加载主题，减少闪烁
  chrome.storage.sync.get({ theme: 'system' }, (settings) => {
    applyTheme(settings.theme);
  });

  initTabs();
  initSearch();
  initSettings();
});
