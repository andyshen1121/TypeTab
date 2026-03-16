'use strict';

let tabCache = [];
let selectedIndex = 0;
let debounceTimer = null;

// 搜索算法（与 content.js 一致）
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
        ? `<img class="favicon" src="${tab.favIconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="favicon-fallback" style="display:none">&#127760;</div>`
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
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
});
