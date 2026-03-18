# TypeTab HANDOFF

## 项目简介
Chrome 扩展，提供标签页搜索、重复标签页拦截等功能。

## 最近完成
- **主题切换功能**: popup.html 和 popup.js 实现了 light/dark/system 三种主题模式
  - CSS 变量方案，`[data-theme]` 属性控制
  - `@media (prefers-color-scheme)` fallback 防闪烁
  - 设置持久化到 chrome.storage.sync
  - 监听系统主题变化自动切换
- **关闭标签页按钮**: 每个搜索结果项 hover 时显示关闭按钮
  - 点击关闭按钮调用 chrome.tabs.remove，从缓存移除并重新渲染
  - stopPropagation 防止触发切换标签页

## 最近完成（续）
- **键盘快捷键关闭标签页**: 新增 `closeTabShortcut` 设置（默认 `ctrl+backspace`）
  - popup.js / content.js：按快捷键关闭当前选中的搜索结果标签页
  - popup.html / options.html：快捷键录制器 UI（点击按钮 -> 录制 -> 保存）
  - 跨平台：Mac Cmd 键归一化为 `ctrl` 存储，formatShortcut 展示时区分 Cmd/Ctrl
  - CSS：键盘选中时也显示 close-btn（`.result-item.selected .close-btn { display: flex; }`）
  - content.js 通过 `chrome.storage.onChanged` 实时同步快捷键变化

## 关键文件
- `popup/popup.html` - 弹窗页面，CSS 变量 + 主题选择器 + 关闭按钮样式 + 快捷键录制器 UI
- `popup/popup.js` - 主题逻辑 + 关闭标签页逻辑 + 快捷键匹配/录制/格式化工具函数
- `options/options.html` - 设置页，含快捷键录制器 UI
- `options/options.js` - 设置逻辑，含快捷键录制器
- `content/content.js` - Spotlight，含快捷键关闭标签页 + storage 实时同步
