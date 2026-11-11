# My Dashboard New Tab – Chrome Extension

A customizable dashboard as the new tab page for Chrome, optionally with bookmarks integration.

## Features

- **Two data sources**: Chrome bookmarks (folder "Dashboard") or manually managed shortcuts
- **Tabs (sets)**: Shortcuts are grouped into sets, which are shown as tabs
- **Drag & drop**: Shortcuts, dividers and tabs can be rearranged via drag & drop
- **Dividers**: Horizontal and vertical lines to structure the layout
- **Quick access bar**: Shows the most used, recently used or (combined) best shortcuts, number of items adjustable (3–12); left click opens the shortcut in the current tab, middle click in a new tab
- **Themes**: Light, Dark, Minimal, Catppuccin Mocha and 8bit
- **Startup behavior**: Remember the last opened tab or always open a specific tab
- **Export / import**: Back up and restore sets, shortcuts and usage statistics as JSON

## Installation

1. Download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the folder containing the extension files

## Usage

### Adding and editing shortcuts
- Use the "+" icon to enter a name and URL (or add a divider)
- URLs without a scheme get `https://` automatically (`http://` for `localhost` and loopback addresses); only `http(s)` addresses are accepted
- In the shortcut settings, shortcuts can be edited, moved to another set or deleted

### Managing tabs
- Click the menu icon (☰) next to the tabs
- Create, rename or delete sets
- Change the order of tabs via drag & drop

### Settings (⚙️)
- Choose a theme
- Set the startup behavior
- Toggle bookmarks mode and refresh bookmarks
- Configure the quick access bar
- Export / import data

### Quick access bar
- An entry appears after its first use and is ranked by the selected mode (most used, recently used or balanced)
- Left click opens the shortcut in the current tab, middle click opens it in a new tab
- Usage is counted per URL (also in bookmarks mode); the same URL in several sets appears only once
- If you change a shortcut's URL, its usage history moves to the new URL

## Bookmarks mode

### 1. Create the Dashboard folder

1. Open `chrome://bookmarks/`
2. Create a folder named **"Dashboard"**
3. Create subfolders inside it for your tabs (e.g. "Work", "Private")

### 2. Add bookmarks

Each subfolder becomes a tab, each bookmark inside it becomes a shortcut.

```
Bookmarks
└── Dashboard
    ├── Work
    │   ├── Gmail
    │   ├── Google Drive
    │   └── Slack
    └── Private
        ├── YouTube
        └── Wikipedia
```

### 3. Activate

1. Open the settings (⚙️)
2. Click "Bookmarks Mode"
3. "Refresh Bookmarks" applies changes immediately

If no "Dashboard" folder is found, a message is shown and the dashboard switches back to manual mode.

## Manual mode (default)

Sets and shortcuts are managed directly in the dashboard and stored locally in `chrome.storage.local`. Data from older versions (`localStorage`) is migrated automatically on first start.

## Updates across multiple devices

The extension does not update itself (unpacked extensions cannot overwrite their own files, and MV3 forbids remotely hosted code). Instead:

1. Clone the repo on each device and load the clone as an unpacked extension in `chrome://extensions/`
2. On startup, `update-check.js` checks (at most every 6 hours) whether the `manifest.json` on GitHub has a newer `version` and shows a notice if so
3. Run `git pull` on the device. Changes to HTML/JS/CSS usually apply on the next new tab; for manifest changes, reload the extension

Setup: set `UPDATE_MANIFEST_URL` in `update-check.js` to the raw URL of the `manifest.json` in your repo. The repo must be public (raw URLs of private repos return 404 without login, so the check silently does nothing). No `host_permissions` are needed, because `raw.githubusercontent.com` allows cross-origin requests. Bump the `version` in `manifest.json` whenever you publish a change. Export files containing personal data do not belong in the repo.

Data (sets, shortcuts, settings) is stored per device in `chrome.storage.local` and is not synchronized via GitHub.

## Technical details

- **Manifest version**: 3
- **Permissions**: `bookmarks`, `storage`
- **Data storage**: `chrome.storage.local` (schema version 2, see `storage.js`); usage statistics are kept per URL in a separate key `usageStats`
- **Multiple open pages**: Open dashboard pages pick up each other's changes via `chrome.storage.onChanged`, so a stale page does not overwrite newer data
- **Shortcut icons**: Favicons via the Google favicon service
- **UI icons**: Font Awesome 6 (via CDN)
- **Themes**: CSS via the `data-theme` attribute on `body`

## Troubleshooting

### Bookmarks are not loaded
1. Check that a "Dashboard" folder with subfolders exists
2. Click "Refresh Bookmarks" in the settings

### Extension does not work
1. Check the Chrome console for error messages
2. Reload the extension in `chrome://extensions/`

## Project structure

- `manifest.json`: Extension configuration
- `index.html`: Main interface
- `script.js`: Functionality and logic
- `storage.js`: Storage layer (`chrome.storage.local`, migration, schema)
- `update-check.js`: Update notice based on the version in the GitHub repo
- `style.css`: Styling and themes
- `Ndot-55.otf`: Font for the 8bit theme
- `icons/`: Extension icons (32, 64, 128, 256, 512 px)