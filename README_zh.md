[English](README.md) | 中文

# TypeTab

一个 Chrome 浏览器插件，提供快速标签页搜索和重复标签页管理功能。

当你打开了几十个标签页时，TypeTab 帮你即时找到并切换到目标页面。

## 功能特性

- **Spotlight 搜索** - 按 `Ctrl+Shift+K`（Mac: `Cmd+Shift+K`）唤起 Spotlight 风格的搜索浮层，按标题或 URL 模糊搜索已打开的标签页。
- **重复标签页拦截** - 当你打开一个已经存在的页面时，TypeTab 会提示你切换到已有标签页，或自动静默切换。
- **可配置设置** - 支持提示/静默拦截模式、URL 精确/域名匹配规则，可随时开关。

## 安装

### Chrome Web Store

*即将上架*

### 开发 / 本地安装

1. 克隆仓库：
   ```bash
   git clone https://github.com/andyshen1121/TypeTab.git
   cd TypeTab
   ```

2. 生成占位图标：
   ```bash
   bun run scripts/generate-icons.js
   ```

3. 打开 Chrome，访问 `chrome://extensions/`

4. 开启右上角的**开发者模式**

5. 点击**加载已解压的扩展程序**，选择项目根目录

6. 工具栏出现 TypeTab 图标即安装成功

## 使用方法

### 标签页搜索

1. 按 `Ctrl+Shift+K`（Mac: `Cmd+Shift+K`）打开搜索浮层
2. 输入关键词，按标题或 URL 过滤标签页
3. `上/下箭头` 导航，`Enter` 切换，`Esc` 关闭

### 重复标签页拦截

当你打开一个已存在的 URL 时：
- **提示模式**（默认）：页面右上角弹出提示条，询问是否切换到已有标签页
- **静默模式**：自动切换到已有标签页并关闭新标签页

### 设置

右键 TypeTab 图标 > **选项**进行配置：
- 开启/关闭拦截功能
- 切换提示模式和静默模式
- 选择 URL 精确匹配或域名匹配
- 通过 `chrome://extensions/shortcuts` 自定义快捷键

## 项目结构

```
TypeTab/
├── manifest.json            # Chrome Extension Manifest V3
├── background/
│   └── service-worker.js    # 标签页管理、搜索、重复检测
├── content/
│   ├── content.js           # Spotlight UI（Shadow DOM）
│   └── content.css
├── popup/
│   ├── popup.html           # 受限页面兜底搜索
│   └── popup.js
├── options/
│   ├── options.html         # 设置页面
│   └── options.js
├── lib/
│   ├── search.js            # 搜索算法（纯函数）
│   └── search.test.js       # 测试（bun test）
├── icons/                   # 插件图标
└── scripts/
    └── generate-icons.js    # 图标生成脚本
```

## 技术栈

- Chrome Extension Manifest V3
- 原生 JavaScript（无构建工具）
- Shadow DOM 样式隔离
- Chrome APIs: tabs, storage, notifications, scripting, commands, windows

## License

MIT
