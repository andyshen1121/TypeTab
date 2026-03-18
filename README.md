[中文](README_zh.md) | English

# TypeTab

A Chrome extension for quick tab search and duplicate tab management.

When you have dozens of tabs open, TypeTab helps you find and switch to the right one instantly.

## Features

- **Spotlight Search** - Press `Ctrl+Shift+K` (Mac: `Cmd+Shift+K`) to open a Spotlight-style search overlay. Search by tab title or URL with fuzzy matching. On restricted pages (e.g. `chrome://`), falls back to a popup search.
- **Close Tabs from Search** - Hover over any result to reveal a close button, or use a keyboard shortcut (`Ctrl+Backspace` / `Cmd+Backspace` by default) to close the selected tab without leaving the search overlay. The shortcut is fully customizable.
- **Theme Support** - Choose between Light, Dark, or System (follows your OS setting) from the Settings tab.
- **Duplicate Tab Detection** - When you open a URL that's already open in another tab, TypeTab detects it and can prompt you to switch or silently redirect. In-page navigation within the same site is never interrupted.
- **Configurable Settings** - Click the toolbar icon to access Search and Settings tabs. Choose between prompt or silent interception mode and URL-exact or domain-level matching.

## Installation

### From Chrome Web Store

*Coming soon*

### Development / Local Install

1. Clone this repo:
   ```bash
   git clone https://github.com/andyshen1121/TypeTab.git
   cd TypeTab
   ```

2. Generate placeholder icons:
   ```bash
   bun run scripts/generate-icons.js
   ```

3. Open Chrome and navigate to `chrome://extensions/`

4. Enable **Developer mode** (toggle in the top right)

5. Click **Load unpacked** and select the project root directory

6. The TypeTab icon should appear in the toolbar

## Usage

### Tab Search

1. Press `Ctrl+Shift+K` (Mac: `Cmd+Shift+K`) to open the search overlay
2. Type keywords to filter open tabs by title or URL
3. Use `Arrow Up/Down` to navigate, `Enter` to switch, `Esc` to close
4. Press `Ctrl+Backspace` (Mac: `Cmd+Backspace`) to close the selected tab

### Duplicate Tab Interception

When you navigate to a URL that's already open:
- **Prompt mode** (default): a notification bar asks if you want to switch to the existing tab
- **Silent mode**: automatically switches to the existing tab and closes the new one

### Settings

Click the TypeTab toolbar icon and switch to the **Settings** tab:
- Enable/disable interception
- Switch between prompt and silent mode
- Choose URL-exact or domain-level matching
- Set the **theme** (Light / Dark / System)
- Customize the **close tab shortcut** (click the shortcut key button and press a new combo)
- Customize the **search shortcut** via `chrome://extensions/shortcuts`

## Project Structure

```
TypeTab/
├── manifest.json            # Chrome Extension Manifest V3
├── background/
│   └── service-worker.js    # Tab management, search, duplicate detection
├── content/
│   ├── content.js           # Spotlight UI (Shadow DOM)
│   └── content.css
├── popup/
│   ├── popup.html           # Popup UI (Search + Settings tabs)
│   └── popup.js
├── options/
│   ├── options.html         # Settings page
│   └── options.js
├── lib/
│   ├── search.js            # Search algorithm (pure functions)
│   └── search.test.js       # Tests (bun test)
├── icons/                   # Extension icons
└── scripts/
    └── generate-icons.js    # Icon generator
```

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no build tools)
- Shadow DOM for style isolation
- Chrome APIs: tabs, storage, notifications, scripting, commands, windows

## Privacy

TypeTab works entirely locally. It does not collect, store, or transmit any personal data. All tab information is processed in your browser and never leaves your device. No analytics, no tracking, no external servers.

## License

MIT
