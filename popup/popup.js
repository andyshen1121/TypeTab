'use strict';

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
        ? `<img class="favicon" src="${escapeHtml(tab.favIconUrl)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="favicon-fallback" style="display:none">&#127760;</div>`
        : '<div class="favicon-fallback">&#127760;</div>'
      }
      <div class="info">
        <div class="title">${escapeHtml(tab.title || '(无标题)')}</div>
        <div class="url">${escapeHtml(tab.url || '')}</div>
      </div>
    </div>
  `).join('');

  resultsEl.querySelectorAll('.result-item').forEach((el) => {
    el.addEventListener('click', () => {
      switchToTab(parseInt(el.dataset.tabId, 10));
    });
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
    }
  });
}

// ===== 设置功能 =====

const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  interceptMode: 'prompt',
  matchRule: 'exact_url',
};

function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById('interceptEnabled').checked = settings.interceptEnabled;
    document.getElementById('interceptMode').value = settings.interceptMode;
    document.getElementById('matchRule').value = settings.matchRule;
  });
}

function saveSettings() {
  const settings = {
    interceptEnabled: document.getElementById('interceptEnabled').checked,
    interceptMode: document.getElementById('interceptMode').value,
    matchRule: document.getElementById('matchRule').value,
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

  document.getElementById('shortcut-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
}

// ===== 初始化 =====

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSearch();
  initSettings();
});
