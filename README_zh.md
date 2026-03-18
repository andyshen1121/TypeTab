[English](README.md) | 中文

# TypeTab

一个 Chrome 浏览器插件，提供快速标签页搜索和重复标签页管理功能。

当你打开了几十个标签页时，TypeTab 帮你即时找到并切换到目标页面。

## 功能特性

- **Spotlight 搜索** - 按 `Ctrl+Shift+K`（Mac: `Cmd+Shift+K`）唤起 Spotlight 风格的搜索浮层，按标题或 URL 模糊搜索已打开的标签页。受限页面（如 `chrome://`）自动回退到 Popup 搜索。
- **搜索框内关闭标签页** - 鼠标悬停在搜索结果上即可看到关闭按钮；也可用键盘快捷键（默认 `Ctrl+Backspace` / `Cmd+Backspace`）直接关闭当前选中的标签页，无需退出搜索。该快捷键支持自定义。
- **主题模式** - 在设置中选择浅色、深色或跟随系统，自动适配操作系统外观偏好。
- **重复标签页拦截** - 打开另一个标签页中已存在的 URL 时即时检测，可提示切换或自动静默切换。网站内部页面跳转不会触发拦截。
- **可配置设置** - 点击工具栏图标即可在搜索和设置之间切换。支持提示/静默拦截模式、URL 精确/域名匹配规则。

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
4. 按 `Ctrl+Backspace`（Mac: `Cmd+Backspace`）关闭选中的标签页

### 重复标签页拦截

当你打开一个已存在的 URL 时：
- **提示模式**（默认）：页面右上角弹出提示条，询问是否切换到已有标签页
- **静默模式**：自动切换到已有标签页并关闭新标签页

### 设置

点击工具栏 TypeTab 图标，切换到**设置** tab：
- 开启/关闭拦截功能
- 切换提示模式和静默模式
- 选择 URL 精确匹配或域名匹配
- 切换**主题模式**（浅色 / 深色 / 跟随系统）
- 自定义**关闭标签页快捷键**（点击快捷键按钮后按新组合键即可录制）
- 通过 `chrome://extensions/shortcuts` 自定义**搜索快捷键**

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
│   ├── popup.html           # Popup 界面（搜索 + 设置双 tab）
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

## 隐私

TypeTab 完全在本地运行，不收集、存储或传输任何个人数据。所有标签页信息仅在浏览器内处理，不会离开你的设备。无分析、无追踪、无外部服务器。

## License

MIT
