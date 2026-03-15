# TypeTab - Chrome 浏览器 Tab 搜索与管理插件设计文档

## 概述

TypeTab 是一个 Chrome 浏览器插件，解决用户打开大量 Tab 后难以快速定位和管理的问题。

### 核心功能

1. **快捷键搜索**：通过快捷键唤起 Spotlight 风格搜索框，按标题和 URL 模糊搜索已打开的 Tab
2. **重复 Tab 拦截**：当用户打开一个已存在的页面时，提示或自动切换到已有 Tab
3. **用户设置**：支持自定义拦截模式、匹配规则等

### 目标

- 发布到 Chrome Web Store
- 个人使用 + 公开分发

---

## 架构

### 技术方案

采用 Content Script + Popup 混合方案：

- 搜索界面通过 Content Script 注入当前页面，使用 Shadow DOM 隔离样式，实现 Spotlight 效果
- 受限页面（chrome://、Web Store 等）无法注入 Content Script，fallback 到 Browser Action Popup

### 目录结构

```
TypeTab/
├── manifest.json          # V3 Manifest
├── background/
│   └── service-worker.js  # 后台服务：Tab 监听、重复检测、快捷键注册
├── content/
│   └── content.js         # 注入页面：Spotlight 搜索 UI（Shadow DOM）
│   └── content.css        # Spotlight 样式
├── popup/
│   └── popup.html         # 兜底 Popup（受限页面）
│   └── popup.js
├── options/
│   └── options.html       # 设置页面
│   └── options.js
├── icons/                 # 插件图标
└── utils/
    └── tab-search.js      # 共享搜索逻辑
```

### 核心分工

- **Service Worker**：管理所有 Tab 状态，处理消息通信，执行重复 Tab 检测
- **Content Script**：只负责 UI 渲染和用户交互，通过 `chrome.runtime.sendMessage` 向 Service Worker 请求数据
- **Options Page**：设置持久化到 `chrome.storage.sync`

---

## 功能详细设计

### 1. 搜索功能

#### 触发方式

- 用户按快捷键 → Service Worker 收到 `chrome.commands` 事件
- Service Worker 向当前 Tab 的 Content Script 发消息 → 打开 Spotlight
- 如果 Content Script 无法注入（受限页面）→ 打开 Popup 兜底

#### 搜索流程

1. Spotlight 打开，输入框自动获取焦点
2. 用户输入关键词，Content Script 发消息给 Service Worker
3. Service Worker 调用 `chrome.tabs.query({})` 获取所有 Tab
4. 对标题和 URL 做模糊匹配（fuzzy match），按相关度排序返回
5. Content Script 渲染结果列表
6. 用户通过键盘上下选择、回车确认 → 切换到目标 Tab
7. ESC 或点击遮罩关闭 Spotlight

#### 搜索算法

- 先做子串匹配（包含关键词即命中）
- 再按匹配位置 + 标题长度排序（越靠前、标题越短 = 越相关）
- 支持多词搜索，空格分隔，所有词都必须命中（AND 逻辑）
- 搜索不区分大小写

#### 键盘交互

| 按键 | 行为 |
|------|------|
| 上/下箭头 | 移动选中项 |
| Enter | 切换到选中的 Tab |
| ESC | 关闭 Spotlight |

#### Spotlight UI

- 页面中央弹出搜索框，半透明遮罩覆盖页面
- 搜索框包含输入框和结果列表
- 结果列表每项显示：网站 favicon、Tab 标题、URL
- 当前选中项高亮显示
- Shadow DOM 隔离，不与宿主页面样式冲突

### 2. 重复 Tab 拦截

#### 检测时机

- 监听 `chrome.tabs.onUpdated` 事件，当 Tab 的 URL 发生变化（`changeInfo.url` 存在时）触发检测
- 监听 `chrome.tabs.onCreated` 后跟 `onUpdated`，覆盖新开 Tab 的场景

#### 匹配逻辑

- **URL 精确匹配**（默认）：去掉 hash 部分后比较（`https://foo.com/page#section1` 和 `https://foo.com/page#section2` 视为相同）
- **域名匹配**：提取 hostname 比较
- 匹配时排除自身 Tab

#### 拦截行为（根据用户设置）

- **关闭状态**：不做任何处理
- **提示模式**（默认）：通过 Content Script 在当前页面弹出轻量提示条，显示"该页面已在其他标签页中打开，是否切换？"，提供"切换"和"保留"两个按钮
- **静默模式**：直接激活已有 Tab（`chrome.tabs.update(existingTabId, {active: true})`），关闭当前新 Tab

#### 边界情况

- 受限页面无法注入提示条 → fallback 到 `chrome.notifications` 系统通知
- 同一个 URL 有多个已打开的 Tab → 切换到最近活跃的那个

### 3. 设置页面

#### 存储

使用 `chrome.storage.sync`，设置跨设备同步。

#### 设置项

| 设置 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 拦截开关 | boolean | true | 是否启用重复 Tab 拦截 |
| 拦截模式 | enum | prompt | prompt（提示）/ silent（静默） |
| 匹配规则 | enum | exact_url | exact_url（URL 精确）/ domain（域名匹配） |

#### 快捷键

Chrome 插件快捷键必须通过 `chrome://extensions/shortcuts` 系统页面修改。Options 页面提供"修改快捷键"按钮，点击后引导用户跳转。

默认快捷键：`Ctrl+Shift+Space`（Mac: `Command+Shift+Space`）

---

## 权限与 Manifest

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "TypeTab",
  "version": "1.0.0",
  "description": "Quick tab search and duplicate tab management",
  "permissions": ["tabs", "storage", "notifications"],
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
        "default": "Ctrl+Shift+Space",
        "mac": "Command+Shift+Space"
      },
      "description": "打开 TypeTab 搜索"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"],
    "css": ["content/content.css"]
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

### 权限说明

| 权限 | 用途 |
|------|------|
| `tabs` | 读取所有 Tab 的标题和 URL，核心搜索功能 |
| `storage` | 保存用户设置 |
| `notifications` | 受限页面下的重复 Tab 提示兜底 |
| `<all_urls>`（Content Script） | Spotlight UI 注入 |

### 隐私政策要点

- 不收集、不传输任何用户数据
- 所有 Tab 信息仅在本地处理
- 设置通过 Chrome Sync 同步，不经过第三方服务器

---

## 未来扩展

- 搜索范围扩展到页面内容（功能 C）
- 搜索历史记录和书签
- Tab 分组管理
