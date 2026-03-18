'use strict';

const DEFAULT_SETTINGS = {
  interceptEnabled: true,
  interceptMode: 'prompt',
  matchRule: 'exact_url',
  theme: 'system',
  closeTabShortcut: 'ctrl+backspace',
};

let closeTabShortcut = 'ctrl+backspace';

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

// 根据设置值解析实际主题
function resolveTheme(setting) {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return setting;
}

// 应用主题到页面
function applyTheme(themeSetting) {
  document.documentElement.setAttribute('data-theme', resolveTheme(themeSetting));
}

// 加载设置
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

// 保存设置
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
  setTimeout(() => toast.classList.remove('show'), 1500);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // 监听设置变化
  document.getElementById('interceptEnabled').addEventListener('change', saveSettings);
  document.getElementById('interceptMode').addEventListener('change', saveSettings);
  document.getElementById('matchRule').addEventListener('change', saveSettings);

  // 主题切换
  document.getElementById('themeMode').addEventListener('change', () => {
    const themeSetting = document.getElementById('themeMode').value;
    applyTheme(themeSetting);
    saveSettings();
  });

  // 系统主题变化时，如果当前设置为跟随系统，则重新应用
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const currentSetting = document.getElementById('themeMode').value;
    if (currentSetting === 'system') {
      applyTheme('system');
    }
  });

  // 快捷键设置跳转
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
      chrome.storage.sync.set({ closeTabShortcut: shortcut }, showToast);
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
});
