'use strict';

const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  interceptMode: 'prompt',
  matchRule: 'exact_url',
};

// 加载设置
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    document.getElementById('interceptEnabled').checked = settings.interceptEnabled;
    document.getElementById('interceptMode').value = settings.interceptMode;
    document.getElementById('matchRule').value = settings.matchRule;
  });
}

// 保存设置
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
  setTimeout(() => toast.classList.remove('show'), 1500);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // 监听设置变化
  document.getElementById('interceptEnabled').addEventListener('change', saveSettings);
  document.getElementById('interceptMode').addEventListener('change', saveSettings);
  document.getElementById('matchRule').addEventListener('change', saveSettings);

  // 快捷键设置跳转
  document.getElementById('shortcut-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });
});
