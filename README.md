# TypeTab

A Chrome extension for quick tab search and duplicate tab management.

When you have dozens of tabs open, TypeTab helps you find and switch to the right one instantly.

## Features

- **Spotlight Search** - Press `Ctrl+Shift+K` (Mac: `Cmd+Shift+K`) to open a Spotlight-style search overlay. Search by tab title or URL with fuzzy matching.
- **Duplicate Tab Detection** - When you open a page that's already open in another tab, TypeTab can prompt you to switch or silently redirect.
- **Configurable Settings** - Choose between prompt or silent interception mode, URL-exact or domain-level matching, and toggle the feature on/off.

## Installation

### From Chrome Web Store

*Coming soon*

### Development / Local Install

1. Clone this repo:
   ```bash
   git clone https://github.com/your-username/TypeTab.git
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

### Duplicate Tab Interception

When you navigate to a URL that's already open:
- **Prompt mode** (default): a notification bar asks if you want to switch to the existing tab
- **Silent mode**: automatically switches to the existing tab and closes the new one

### Settings

Right-click the TypeTab icon > **Options** to configure:
- Enable/disable interception
- Switch between prompt and silent mode
- Choose URL-exact or domain-level matching
- Customize the keyboard shortcut via `chrome://extensions/shortcuts`

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
│   ├── popup.html           # Fallback search for restricted pages
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

## License

MIT
