# TypeTab Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 TypeTab Chrome 浏览器插件，提供快捷键 Tab 搜索和重复 Tab 拦截功能。

**Architecture:** Content Script + Popup 混合方案。Service Worker 负责 Tab 管理、搜索逻辑和重复检测；Content Script 通过 Shadow DOM 渲染 Spotlight 搜索 UI；Popup 作为受限页面的兜底方案；Options 页面管理用户设置。

**Tech Stack:** Chrome Extension Manifest V3, 原生 JavaScript (无构建工具), Shadow DOM, Chrome APIs (tabs, storage, notifications, scripting, commands), bun (测试纯逻辑函数)

---

## Chunk 1: 项目脚手架

### Task 1: 创建 manifest.json 和目录结构

**Files:**
- Create: `manifest.json`
- Create: `background/service-worker.js` (空壳)
- Create: `content/content.js` (空壳)
- Create: `content/content.css` (空文件)
- Create: `popup/popup.html` (空壳)
- Create: `popup/popup.js` (空壳)
- Create: `options/options.html` (空壳)
- Create: `options/options.js` (空壳)

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p background content popup options icons lib scripts
```

- [ ] **Step 2: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "TypeTab",
  "version": "1.0.0",
  "description": "Quick tab search and duplicate tab management",
  "permissions": ["tabs", "storage", "notifications", "scripting", "windows"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "commands": {
    "open-search": {
      "suggested_key": {
        "default": "Ctrl+Shift+K",
        "mac": "Command+Shift+K"
      },
      "description": "Open TypeTab search"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "css": ["content/content.css"],
    "run_at": "document_idle"
  }],
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": true
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 3: 创建空壳文件**

`background/service-worker.js`:
```javascript
// TypeTab Service Worker
// 负责 Tab 管理、搜索逻辑和重复检测
console.log('TypeTab service worker loaded');
```

`content/content.js`:
```javascript
// TypeTab Content Script
// 负责 Spotlight UI 渲染
window.__typetab_loaded = true;
```

`content/content.css`:
```css
/* TypeTab Spotlight 样式 - 通过 Shadow DOM 注入，此文件留空 */
```

`popup/popup.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>body { width: 360px; min-height: 200px; margin: 0; }</style>
</head>
<body>
  <div id="app"></div>
  <script src="popup.js"></script>
</body>
</html>
```

`popup/popup.js`:
```javascript
// TypeTab Popup - 受限页面兜底搜索
console.log('TypeTab popup loaded');
```

`options/options.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TypeTab Settings</title>
  <style>body { font-family: system-ui, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }</style>
</head>
<body>
  <h1>TypeTab Settings</h1>
  <div id="app"></div>
  <script src="options.js"></script>
</body>
</html>
```

`options/options.js`:
```javascript
// TypeTab Options - 用户设置页面
console.log('TypeTab options loaded');
```

- [ ] **Step 4: 生成插件图标**

使用 SVG 生成 PNG 图标（16x16、48x48、128x128），蓝色背景白色 "T" 字母。

`scripts/generate-icons.js`:
```javascript
// 使用 bun 运行: bun run scripts/generate-icons.js
import { writeFileSync } from 'fs';

// 生成 SVG 字符串
function createSvg(size) {
  const fontSize = Math.round(size * 0.6);
  const radius = Math.round(size * 0.15);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#4285f4"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${fontSize}px" fill="white">T</text>
</svg>`;
}

// 将 SVG 写为文件（Chrome 插件支持 SVG 作为图标源，但需要 PNG 提交 Web Store）
// 方案：先生成 SVG，再用 resvg-js 转 PNG
async function main() {
  const sizes = [16, 48, 128];

  // 尝试使用 resvg-js 转 PNG
  let Resvg;
  try {
    const mod = await import('@aspect-build/rules_js/../resvg-js');
    Resvg = mod.Resvg;
  } catch {
    try {
      const mod = await import('@aspect-build/resvg-js');
      Resvg = mod.Resvg;
    } catch {
      // 如果没有 resvg-js，直接写 SVG 并提示用户手动转换
      for (const size of sizes) {
        const svg = createSvg(size);
        writeFileSync(`icons/icon-${size}.svg`, svg);
      }
      console.log('SVG 图标已生成到 icons/ 目录。');
      console.log('请手动将 SVG 转为 PNG，或运行: bun add -d @aspect-build/resvg-js 后重新执行。');
      console.log('或者使用在线工具如 https://svgtopng.com 转换。');

      // 同时生成极简 PNG（1x1 蓝色像素拉伸，仅用于开发阶段加载插件不报错）
      // PNG 文件头 + IHDR + IDAT + IEND 最小化
      for (const size of sizes) {
        const svg = createSvg(size);
        writeFileSync(`icons/icon-${size}.svg`, svg);
      }
      // 生成简单的纯蓝色 PNG 作为占位图标
      for (const size of sizes) {
        const png = createMinimalPng(size);
        writeFileSync(`icons/icon-${size}.png`, png);
      }
      console.log('已生成占位 PNG 图标，可在开发阶段使用。发布前请替换为正式图标。');
      return;
    }
  }

  for (const size of sizes) {
    const svg = createSvg(size);
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
    const pngData = resvg.render();
    writeFileSync(`icons/icon-${size}.png`, pngData.asPng());
    console.log(`生成 icons/icon-${size}.png`);
  }
}

// 生成最小 PNG（纯蓝色方块，用于开发阶段占位）
function createMinimalPng(size) {
  // 使用 bun 内置能力生成简单 PNG
  // 这里用最简方式：创建未压缩的 PNG
  const { deflateSync } = require('zlib');

  // RGBA 像素数据：蓝色 #4285f4
  const rowSize = size * 4 + 1; // 每行：filter byte + RGBA * width
  const rawData = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 4;
      rawData[offset] = 0x42;     // R
      rawData[offset + 1] = 0x85; // G
      rawData[offset + 2] = 0xf4; // B
      rawData[offset + 3] = 0xff; // A
    }
  }

  const compressed = deflateSync(rawData);

  // 构建 PNG
  const chunks = [];

  // PNG 签名
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createPngChunk('IHDR', ihdr));

  // IDAT
  chunks.push(createPngChunk('IDAT', compressed));

  // IEND
  chunks.push(createPngChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function createPngChunk(type, data) {
  const { crc32 } = require('buffer');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBytes, data]);

  // CRC32
  let crc = 0xffffffff;
  for (const byte of typeAndData) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeAndData, crcBuf]);
}

// CRC32 查找表
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

main();
```

运行：`bun run scripts/generate-icons.js`
预期：`icons/` 下生成 icon-16.png、icon-48.png、icon-128.png（蓝色方块占位图标）

- [ ] **Step 5: 验证插件可加载**

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"，选择项目根目录
4. 确认插件加载成功，无报错
5. 确认工具栏出现 TypeTab 图标

- [ ] **Step 6: 提交**

```bash
git add manifest.json background/ content/ popup/ options/ icons/ scripts/ lib/
git commit -m "feat: scaffold TypeTab Chrome extension project structure"
```

---

## Chunk 2: 搜索算法（纯函数 + 测试）

### Task 2: 实现 Tab 搜索/过滤算法

**Files:**
- Create: `lib/search.js`
- Create: `lib/search.test.js`

搜索逻辑和 URL 匹配逻辑提取为纯函数，可在 Service Worker 和测试环境中共享。Service Worker 通过 `importScripts` 引入（MV3 Service Worker 不支持 ES module import，需用 `importScripts`）。Content Script 和 Popup 内联搜索算法副本（因为它们无法 import Service Worker 的模块）。

- [ ] **Step 1: 编写搜索函数的测试**

`lib/search.test.js`:
```javascript
import { describe, test, expect } from 'bun:test';
import { searchTabs, normalizeUrl, matchesDomain, isDuplicate } from './search.js';

// 模拟 Tab 数据
const mockTabs = [
  { id: 1, title: 'GitHub - Dashboard', url: 'https://github.com/dashboard', favIconUrl: 'https://github.com/favicon.ico' },
  { id: 2, title: 'Google Docs - 项目文档', url: 'https://docs.google.com/document/d/123', favIconUrl: '' },
  { id: 3, title: 'Stack Overflow - JavaScript', url: 'https://stackoverflow.com/questions/123', favIconUrl: '' },
  { id: 4, title: 'GitHub - Pull Requests', url: 'https://github.com/pulls', favIconUrl: '' },
  { id: 5, title: 'TypeTab Options', url: 'chrome-extension://abc/options/options.html', favIconUrl: '' },
];

describe('searchTabs', () => {
  test('空关键词返回所有 Tab', () => {
    const results = searchTabs(mockTabs, '');
    expect(results).toHaveLength(5);
  });

  test('按标题子串匹配', () => {
    const results = searchTabs(mockTabs, 'github');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1);
    expect(results[1].id).toBe(4);
  });

  test('按 URL 子串匹配', () => {
    const results = searchTabs(mockTabs, 'stackoverflow');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  test('不区分大小写', () => {
    const results = searchTabs(mockTabs, 'GITHUB');
    expect(results).toHaveLength(2);
  });

  test('多词搜索 AND 逻辑', () => {
    const results = searchTabs(mockTabs, 'github pull');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(4);
  });

  test('无匹配返回空数组', () => {
    const results = searchTabs(mockTabs, 'nonexistent');
    expect(results).toHaveLength(0);
  });

  test('匹配位置靠前的排序更高', () => {
    const tabs = [
      { id: 1, title: 'ABC test page', url: 'https://example.com', favIconUrl: '' },
      { id: 2, title: 'test page ABC', url: 'https://example.com', favIconUrl: '' },
    ];
    const results = searchTabs(tabs, 'test');
    // "test page ABC" 中 test 在位置 0（去掉前面的不算），但 "ABC test page" 中 test 在位置 4
    // 实际上 "test page ABC" 的 test 位置更靠前
    expect(results[0].id).toBe(2);
  });

  test('最多返回 20 条结果', () => {
    const manyTabs = Array.from({ length: 30 }, (_, i) => ({
      id: i, title: `Tab ${i}`, url: `https://example.com/${i}`, favIconUrl: ''
    }));
    const results = searchTabs(manyTabs, 'tab');
    expect(results).toHaveLength(20);
  });
});

describe('normalizeUrl', () => {
  test('去掉 hash 部分', () => {
    expect(normalizeUrl('https://foo.com/page#section1')).toBe('https://foo.com/page');
  });

  test('没有 hash 的 URL 保持不变', () => {
    expect(normalizeUrl('https://foo.com/page')).toBe('https://foo.com/page');
  });

  test('去掉尾部斜杠', () => {
    expect(normalizeUrl('https://foo.com/')).toBe('https://foo.com');
  });
});

describe('matchesDomain', () => {
  test('相同域名返回 true', () => {
    expect(matchesDomain('https://github.com/foo', 'https://github.com/bar')).toBe(true);
  });

  test('不同域名返回 false', () => {
    expect(matchesDomain('https://github.com/foo', 'https://google.com/bar')).toBe(false);
  });

  test('子域名视为不同', () => {
    expect(matchesDomain('https://docs.google.com', 'https://mail.google.com')).toBe(false);
  });
});

describe('isDuplicate', () => {
  test('exact_url 模式：相同 URL 返回 true', () => {
    expect(isDuplicate('https://foo.com/page', 'https://foo.com/page', 'exact_url')).toBe(true);
  });

  test('exact_url 模式：不同 hash 视为相同', () => {
    expect(isDuplicate('https://foo.com/page#a', 'https://foo.com/page#b', 'exact_url')).toBe(true);
  });

  test('exact_url 模式：不同路径返回 false', () => {
    expect(isDuplicate('https://foo.com/a', 'https://foo.com/b', 'exact_url')).toBe(false);
  });

  test('domain 模式：相同域名返回 true', () => {
    expect(isDuplicate('https://foo.com/a', 'https://foo.com/b', 'domain')).toBe(true);
  });

  test('domain 模式：不同域名返回 false', () => {
    expect(isDuplicate('https://foo.com/a', 'https://bar.com/b', 'domain')).toBe(false);
  });

  test('空 URL 返回 false', () => {
    expect(isDuplicate('', 'https://foo.com', 'exact_url')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
bun test lib/search.test.js
```

预期：FAIL，因为 `lib/search.js` 还不存在。

- [ ] **Step 3: 实现搜索函数**

`lib/search.js`:
```javascript
/**
 * 搜索 Tab 列表
 * @param {Array} tabs - chrome.tabs.query 返回的 Tab 对象数组
 * @param {string} query - 用户输入的搜索关键词
 * @param {number} [maxResults=20] - 最大返回条数
 * @returns {Array} 匹配的 Tab 列表，按相关度排序
 */
export function searchTabs(tabs, query, maxResults = 20) {
  if (!query || !query.trim()) {
    return tabs.slice(0, maxResults);
  }

  const keywords = query.toLowerCase().trim().split(/\s+/);

  const scored = [];
  for (const tab of tabs) {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    const combined = title + ' ' + url;

    // 所有关键词都必须命中（AND 逻辑）
    let allMatch = true;
    let totalScore = 0;

    for (const keyword of keywords) {
      const titleIndex = title.indexOf(keyword);
      const urlIndex = url.indexOf(keyword);

      if (titleIndex === -1 && urlIndex === -1) {
        allMatch = false;
        break;
      }

      // 标题匹配优先于 URL 匹配
      // 匹配位置越靠前分数越高
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

  // 按分数降序排序
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, maxResults).map((item) => item.tab);
}

/**
 * 标准化 URL，去掉 hash 和尾部斜杠
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url.split('#')[0];
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * 判断两个 URL 是否属于同一域名
 * @param {string} url1
 * @param {string} url2
 * @returns {boolean}
 */
export function matchesDomain(url1, url2) {
  try {
    const host1 = new URL(url1).hostname;
    const host2 = new URL(url2).hostname;
    return host1 === host2;
  } catch {
    return false;
  }
}

/**
 * 判断两个 URL 是否重复（根据匹配规则）
 * @param {string} url1
 * @param {string} url2
 * @param {'exact_url'|'domain'} matchRule
 * @returns {boolean}
 */
export function isDuplicate(url1, url2, matchRule) {
  if (!url1 || !url2) return false;
  if (matchRule === 'domain') {
    return matchesDomain(url1, url2);
  }
  return normalizeUrl(url1) === normalizeUrl(url2);
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
bun test lib/search.test.js
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/
git commit -m "feat: implement tab search algorithm with tests"
```

---

## Chunk 3: Content Script - Spotlight UI

### Task 3: 实现 Spotlight 搜索界面

**Files:**
- Modify: `content/content.js`
- Modify: `content/content.css` (不使用，样式在 Shadow DOM 内)

Content Script 负责：
1. 创建 Shadow DOM 容器
2. 渲染搜索输入框和结果列表
3. 处理键盘交互（上下选择、回车切换、ESC 关闭）
4. 通过 `chrome.runtime.sendMessage` 与 Service Worker 通信

- [ ] **Step 1: 实现 Shadow DOM 容器和 Spotlight UI**

`content/content.js`:
```javascript
// 防止重复注入
if (window.__typetab_loaded) {
  // 如果已加载，只处理来自 Service Worker 的消息
} else {
  window.__typetab_loaded = true;
}

(function () {
  'use strict';

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
    // 创建宿主容器
    container = document.createElement('div');
    container.id = 'typetab-spotlight-host';
    document.body.appendChild(container);

    // Shadow DOM 隔离
    shadowRoot = container.attachShadow({ mode: 'closed' });
    shadowRoot.innerHTML = `
      <style>${getStyles()}</style>
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
          ? `<img class="favicon" src="${tab.favIconUrl}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="favicon-fallback" style="display:none">&#127760;</div>`
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

    if (!container) {
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
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SPOTLIGHT') {
      openSpotlight();
      sendResponse({ success: true });
    } else if (message.type === 'SHOW_DUPLICATE_PROMPT') {
      showDuplicatePrompt(message.existingTabId, message.newTabId, message.title);
      sendResponse({ success: true });
    }
    return true;
  });

  // 重复 Tab 提示条（Task 5 中实现细节）
  function showDuplicatePrompt(existingTabId, newTabId, title) {
    // 将在 Task 5 中实现
  }
})();
```

- [ ] **Step 2: 在 Chrome 中加载插件，验证 Spotlight 不会在正常页面上造成视觉干扰**

1. 重新加载插件
2. 打开任意网页
3. 确认页面正常显示，无多余 UI 元素（Spotlight 应为 hidden 状态）

- [ ] **Step 3: 提交**

```bash
git add content/
git commit -m "feat: implement Spotlight search UI with Shadow DOM"
```

---

## Chunk 4: Service Worker - 命令处理与消息通信

### Task 4: 实现 Service Worker 核心逻辑

**Files:**
- Modify: `background/service-worker.js`
- Modify: `manifest.json` (如需微调)

Service Worker 负责：
1. 监听快捷键命令
2. 向 Content Script 发消息打开 Spotlight
3. 处理 Content Script 的搜索请求和 Tab 切换请求
4. fallback 逻辑（动态注入 / Popup）

- [ ] **Step 1: 实现快捷键命令处理和消息路由**

`background/service-worker.js`:
```javascript
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
```

- [ ] **Step 2: 在 Chrome 中测试快捷键触发**

1. 重新加载插件
2. 打开一个普通网页（如 google.com）
3. 按 `Ctrl+Shift+K`（Mac: `Cmd+Shift+K`）
4. 确认 Spotlight 弹出
5. 输入关键词，确认结果列表正确显示
6. 用键盘上下选择，回车切换到目标 Tab
7. 按 ESC 关闭

- [ ] **Step 3: 测试 fallback 逻辑**

1. 在 `chrome://extensions/` 页面按快捷键
2. 确认 Popup 弹出（或 console 提示用户手动点击）

- [ ] **Step 4: 提交**

```bash
git add background/service-worker.js
git commit -m "feat: implement service worker command handler and messaging"
```

---

## Chunk 5: 重复 Tab 拦截

### Task 5: 实现重复 Tab 检测和拦截

**Files:**
- Modify: `background/service-worker.js` (追加重复检测逻辑)
- Modify: `content/content.js` (实现 `showDuplicatePrompt`)

- [ ] **Step 1: 在 Service Worker 中添加重复 Tab 检测逻辑**

在 `background/service-worker.js` 顶部添加 `importScripts('../lib/search.js');`（需要先将 `lib/search.js` 改为 IIFE 导出到全局变量，见下方说明）。

由于 MV3 Service Worker 使用 `importScripts` 而非 ES module，需要在 `lib/search.js` 顶部加一个全局导出兼容层：

在 `lib/search.js` 文件末尾追加：
```javascript
// Service Worker importScripts 兼容：将函数挂到 globalThis
if (typeof globalThis !== 'undefined') {
  globalThis.searchTabs = searchTabs;
  globalThis.normalizeUrl = normalizeUrl;
  globalThis.matchesDomain = matchesDomain;
  globalThis.isDuplicate = isDuplicate;
}
```

然后在 `background/service-worker.js` 顶部添加：
```javascript
importScripts('../lib/search.js');
```

在 `background/service-worker.js` 末尾追加：

```javascript
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
      chrome.notifications.onButtonClicked.addListener(function handler(notifId, btnIndex) {
        if (notifId === `typetab-dup-${tabId}` && btnIndex === 0) {
          chrome.tabs.update(existingTab.id, { active: true }).then((t) => {
            chrome.windows.update(t.windowId, { focused: true });
            chrome.tabs.remove(tabId).catch(() => {});
          }).catch(() => {});
          chrome.notifications.onButtonClicked.removeListener(handler);
        }
      });
    }
  }
});

// isDuplicate 和 normalizeUrl 由 importScripts('../lib/search.js') 引入，无需重复定义
```

- [ ] **Step 2: 在 Content Script 中实现重复 Tab 提示条**

在 `content/content.js` 的 IIFE 内部，做以下两处修改：
1. 找到 `showDuplicatePrompt` 函数（占位实现，函数体只有注释），替换为下方完整实现
2. 在 IIFE 内部、`showDuplicatePrompt` 函数之后，添加 `getDuplicatePromptStyles` 函数

注意：这两个函数必须在 IIFE 内部，与 `shadowRoot`、`container`、`escapeHtml`、`getStyles` 等变量在同一闭包作用域中。

```javascript
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

  // 5 秒后自动消失
  setTimeout(() => {
    if (prompt.parentNode) prompt.remove();
  }, 5000);
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
```

- [ ] **Step 3: 手动测试重复 Tab 拦截**

1. 重新加载插件
2. 打开 `https://github.com`
3. 新开一个 Tab，再次输入 `https://github.com` 并回车
4. 确认页面右上角出现提示条"github.com 已在其他标签页中打开"
5. 点击"切换"按钮，确认切换到原有 Tab 并关闭新 Tab
6. 重复测试，点击"保留"按钮，确认新 Tab 保留

- [ ] **Step 4: 提交**

```bash
git add background/service-worker.js content/content.js
git commit -m "feat: implement duplicate tab detection and interception"
```

---

## Chunk 6: Popup 兜底 + Options 设置页面

### Task 6: 实现 Popup 兜底搜索

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.js`

- [ ] **Step 1: 实现 Popup UI**

`popup/popup.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 380px;
      min-height: 200px;
      max-height: 500px;
      background: #1e1e2e;
      color: #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }
    .search-box {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #2e2e3e;
      gap: 8px;
    }
    .search-icon { color: #888; flex-shrink: 0; }
    .search-box input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: #e0e0e0;
      font-size: 15px;
      caret-color: #4285f4;
    }
    .search-box input::placeholder { color: #666; }
    .results {
      max-height: 440px;
      overflow-y: auto;
      padding: 4px 0;
    }
    .results::-webkit-scrollbar { width: 5px; }
    .results::-webkit-scrollbar-track { background: transparent; }
    .results::-webkit-scrollbar-thumb { background: #3e3e4e; border-radius: 3px; }
    .result-item {
      display: flex;
      align-items: center;
      padding: 8px 14px;
      cursor: pointer;
      gap: 8px;
    }
    .result-item:hover, .result-item.selected { background: #2e2e3e; }
    .favicon {
      width: 18px;
      height: 18px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .favicon-fallback {
      width: 18px;
      height: 18px;
      border-radius: 3px;
      background: #3e3e4e;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #888;
      flex-shrink: 0;
    }
    .info { flex: 1; overflow: hidden; }
    .title {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .url {
      color: #666;
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .no-results {
      padding: 20px 14px;
      text-align: center;
      color: #666;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="search-box">
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
    </svg>
    <input type="text" id="search-input" placeholder="搜索已打开的标签页..." autocomplete="off" />
  </div>
  <div class="results" id="results"></div>
  <script src="popup.js"></script>
</body>
</html>
```

`popup/popup.js`:
```javascript
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
```

- [ ] **Step 2: 手动测试 Popup**

1. 重新加载插件
2. 点击工具栏 TypeTab 图标
3. 确认 Popup 打开，搜索框自动聚焦
4. 输入关键词，确认搜索结果正确
5. 点击结果项，确认切换到目标 Tab 并 Popup 关闭

- [ ] **Step 3: 提交**

```bash
git add popup/
git commit -m "feat: implement popup fallback search UI"
```

### Task 7: 实现 Options 设置页面

**Files:**
- Modify: `options/options.html`
- Modify: `options/options.js`

- [ ] **Step 1: 实现设置页面 UI 和逻辑**

`options/options.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TypeTab Settings</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 32px;
      max-width: 560px;
      margin: 0 auto;
      color: #333;
      background: #fafafa;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .setting-group {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .setting-group h2 {
      font-size: 16px;
      margin-bottom: 16px;
      font-weight: 600;
    }
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }
    .setting-row + .setting-row {
      border-top: 1px solid #f0f0f0;
    }
    .setting-label {
      font-size: 14px;
    }
    .setting-desc {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }
    select {
      padding: 6px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      background: white;
      cursor: pointer;
    }
    .toggle {
      position: relative;
      width: 44px;
      height: 24px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #ccc;
      border-radius: 12px;
      transition: 0.2s;
    }
    .toggle .slider::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      left: 2px;
      bottom: 2px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .toggle input:checked + .slider { background: #4285f4; }
    .toggle input:checked + .slider::before { transform: translateX(20px); }
    .shortcut-link {
      display: inline-block;
      margin-top: 16px;
      padding: 8px 16px;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      text-decoration: none;
    }
    .shortcut-link:hover { background: #3b78e7; }
    .saved-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #333;
      color: white;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .saved-toast.show { opacity: 1; }
  </style>
</head>
<body>
  <h1>TypeTab Settings</h1>
  <p class="subtitle">管理标签页搜索和重复拦截的设置</p>

  <div class="setting-group">
    <h2>重复标签页拦截</h2>
    <div class="setting-row">
      <div>
        <div class="setting-label">启用拦截</div>
        <div class="setting-desc">打开已存在的页面时进行拦截</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="interceptEnabled" />
        <span class="slider"></span>
      </label>
    </div>
    <div class="setting-row">
      <div>
        <div class="setting-label">拦截模式</div>
        <div class="setting-desc">提示模式会询问你是否切换</div>
      </div>
      <select id="interceptMode">
        <option value="prompt">提示</option>
        <option value="silent">静默切换</option>
      </select>
    </div>
    <div class="setting-row">
      <div>
        <div class="setting-label">匹配规则</div>
        <div class="setting-desc">判断两个标签页是否重复的规则</div>
      </div>
      <select id="matchRule">
        <option value="exact_url">URL 精确匹配</option>
        <option value="domain">域名匹配</option>
      </select>
    </div>
  </div>

  <div class="setting-group">
    <h2>快捷键</h2>
    <div class="setting-row">
      <div>
        <div class="setting-label">搜索快捷键</div>
        <div class="setting-desc">在 Chrome 快捷键设置中修改</div>
      </div>
    </div>
    <button class="shortcut-link" id="shortcut-btn">修改快捷键</button>
  </div>

  <div class="saved-toast" id="toast">设置已保存</div>

  <script src="options.js"></script>
</body>
</html>
```

`options/options.js`:
```javascript
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
```

- [ ] **Step 2: 手动测试 Options 页面**

1. 右键 TypeTab 图标 → "选项"
2. 确认设置页面正常打开
3. 修改拦截开关、模式、匹配规则
4. 确认出现"设置已保存"提示
5. 关闭页面，重新打开，确认设置持久化
6. 点击"修改快捷键"，确认跳转到 `chrome://extensions/shortcuts`

- [ ] **Step 3: 测试设置生效**

1. 关闭拦截开关 → 新开重复 Tab → 确认不拦截
2. 开启拦截，切换到静默模式 → 新开重复 Tab → 确认直接切换
3. 切换到域名匹配 → 打开同域名不同路径 → 确认拦截

- [ ] **Step 4: 提交**

```bash
git add options/
git commit -m "feat: implement options page with settings persistence"
```

---

## Chunk 7: 集成测试与发布准备

### Task 8: 端到端测试与打磨

**Files:**
- 可能微调所有文件

- [ ] **Step 1: 全功能集成测试**

按以下场景逐一测试：

| 场景 | 预期结果 |
|------|----------|
| 普通页面按快捷键 | Spotlight 弹出，搜索正常 |
| 多词搜索 | AND 逻辑，结果正确 |
| 键盘上下选择+回车 | 切换到目标 Tab |
| ESC 关闭 | Spotlight 消失 |
| 点击遮罩关闭 | Spotlight 消失 |
| 受限页面按快捷键 | Popup 弹出 |
| Popup 搜索 | 搜索正常，点击结果切换 Tab |
| 新开重复 Tab（提示模式） | 提示条出现 |
| 点击"切换" | 切换到已有 Tab，关闭新 Tab |
| 点击"保留" | 提示条消失，新 Tab 保留 |
| 新开重复 Tab（静默模式） | 自动切换，新 Tab 关闭 |
| 拦截关闭 | 不拦截 |
| URL 精确匹配 | 相同 URL 拦截，不同路径不拦截 |
| 域名匹配 | 同域名拦截 |
| 跨窗口搜索和切换 | 能搜索到其他窗口的 Tab |

- [ ] **Step 2: 修复测试中发现的问题（如无 bug 则跳过）**

根据集成测试结果修复 bug。如果所有场景通过，跳过此步骤。

- [ ] **Step 3: 生成正式图标**

确保 `icons/` 下有 16x16、48x48、128x128 三种尺寸的 PNG 图标。

- [ ] **Step 4: 提交（如有修改）**

```bash
git add manifest.json background/ content/ popup/ options/ lib/ icons/
git commit -m "fix: integration test fixes and polish"
```

- [ ] **Step 5: 运行搜索算法测试确认通过**

```bash
bun test lib/search.test.js
```

预期：全部 PASS。

- [ ] **Step 6: 最终提交（如有修改）**

```bash
git add manifest.json background/ content/ popup/ options/ lib/ icons/
git commit -m "chore: ready for Chrome Web Store submission"
```
