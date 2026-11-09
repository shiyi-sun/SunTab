# SunTab

**A quiet, local-first new tab page for Chromium.** SunTab replaces the new tab with a wallpaper, a clock, a search bar, and a small desktop of the sites you actually use. No account, no cloud sync, no telemetry, and no remote component store.

Version **0.2.10** · [简体中文](./README.zh-CN.md)

## Why SunTab

Most new tab pages want to be a portal. SunTab tries to be a desk: one calm background, one clock, one search field, and the icons you put there yourself. Everything is stored on your machine; SunTab goes online only when you enable the Bing daily wallpaper, or when you add an automatic icon and read a site's page.

## Features

### Wallpaper and clock

- Five gradient presets: 玄纸 (paper), 夜航 (night flight, the default), 雾蓝 (mist blue), 青瓷 (celadon), and 初雪 (first snow).
- Six solid colors: 雾紫, 深蓝, 蓝灰, 酒红, 墨绿, and 纯黑, plus any custom color you pick.
- Local images (JPG, PNG, or WebP up to 8 MB) and an optional Bing daily wallpaper. Uploaded images stay in Recent uploads, where you can switch back or delete them.
- Blur from 0–20 px and a dim overlay from 0–60%.
- Light built-in wallpapers switch the desktop text, search field, and icon labels to dark ink automatically.
- Clock with 12/24-hour format, optional seconds, lunar date and solar term, 40–140 px size, and a custom color.

### Search

- Baidu, Bing, Google, and DuckDuckGo are built in. Add, edit, or remove engines with a `%s` URL template.
- Enter a domain or IP to open it directly; enter a query to search with the current engine.
- Switch engines from the search bar. Results open in a new tab by default.
- Engine prefixes: `b` / `bd` for Baidu, `g` for Google, `bing`, `ddg`, or a custom engine ID. For example, `g suntab`.
- Local icon search matches names, Chinese characters, full pinyin, and pinyin initials. Use `↑` / `↓` to choose and `Enter` to open. There are no web suggestions.

### Icon desktop

- Tiles from 36–120 px (50 px by default), with adjustable gap, corner radius, label size, label color, and maximum grid width.
- Icon sources: an automatically resolved site icon (SVG first; then declared PNG / WebP of at least 96px; then a header brand image, preferring the independent mark and keeping the whole image when no mark can be separated), a text initial with a color, an uploaded image, or an image URL. Automatic bitmaps are stored as 128px WebP; when no high-resolution icon exists, the browser's cached site icon is used, then the text initial.
- Image icons use a white backdrop by default. Edge detection keeps transparent artwork at 80% with even padding and lets full-bleed images fill the tile; white-only artwork switches to a dark backdrop (the site's theme-color when dark enough). The backdrop can be changed or removed for each icon.
- Folders, groups, drag-to-reorder, and context menus for icons, folders, groups, and empty space.
- Drag sorting uses a clean drop line that stays in the gap nearest the pointer. Light wallpaper cards keep a hairline and a soft shadow; dark wallpaper cards use the soft shadow only.

### Desktop and groups

- Sidebar groups on the left or right, with adjustable width, opacity, and auto-hide.
- Minimal mode keeps only the clock, search, and quote. Click the clock to toggle it.
- The quote footer can be hidden.
- Right-click anywhere on the desktop for the SunTab menu: add icon, new folder, new group, change wallpaper, or open settings. Text fields keep the browser's native menu.

### Quick add

- Pin SunTab to the toolbar and click it on any normal web page, or press `Alt+Shift+S`.
- Choose a group and save. The popup confirms and closes itself, and duplicate URLs are detected.
- Quick add tries to read the page's site icon. When site access is already granted, it prefers the icons and header logos already rendered in the page; without site access it uses the browser's cached site icon and never shows an extra site-access prompt.

### Settings and data

- Settings open in a side drawer, so wallpaper changes preview live.
- Sections: Appearance, Wallpaper, Search, Icons, Clock, Layout, Sidebar, Data, and About.
- JSON export and import include settings, groups, folders, and icon images (uploaded, or automatically fetched SVG / WebP). Wallpaper images are not included.
- Import shows a preview and downloads a backup of the current data first.
- Import restores only uploaded icons referenced by the new navigation and removes old icon records that are no longer referenced.
- “Restore default settings” resets appearance, search, icons, clock, layout, and sidebar, but keeps icons and groups.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `/` or `Ctrl+K` (`⌘K` on macOS) | Focus the search field |
| `↑` / `↓` | Select a local icon result |
| `Enter` | Search, open a URL, or open the selected icon |
| `Esc` | Close suggestions, clear focus, or cancel a drag |
| `Alt+Shift+S` | Open quick add |
| Click the clock | Toggle minimal mode |

## Install

SunTab runs in Chrome, Chromium, and Microsoft Edge. Releases contain a Chrome/Chromium package and an Edge package built from the same extension.

### Chrome / Chromium

1. Download `SunTab-0.2.10-chrome.zip` from the [GitHub Releases](https://github.com/shiyi-sun/SunTab/releases) or [AtomGit Releases](https://atomgit.com/shiyi-sun/SunTab/releases) page.
2. Unzip it into a permanent folder, for example `D:\SunTab\0.2.10`.
3. Open `chrome://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and select the extracted `SunTab` folder.
5. Open a new tab.

### Microsoft Edge

1. Download `SunTab-0.2.10-edge.zip` from Releases.
2. Unzip it into a permanent folder, for example `D:\SunTab\0.2.10-edge`.
3. Open `edge://extensions` and turn on **Developer mode**.
4. Click **Load unpacked** and select the extracted `SunTab` folder.
5. Open a new tab.

Do not move or delete the folder after loading the extension. Edge keeps its own extension data; use a JSON backup to move settings and icons from another browser.

### Build from source

Requirements: Node.js 20+ and pnpm 11+.

```bash
pnpm install
pnpm build
```

Then load `.output/chrome-mv3` as an unpacked extension. For development, `pnpm dev` starts a browser with the extension loaded.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save settings and navigation in `chrome.storage.local` |
| `unlimitedStorage` | Store uploaded icons and wallpapers in IndexedDB |
| `favicon` | Read the browser's local icon cache for the quick-add preview, automatic fallback, and legacy favicon icons |
| `activeTab` | Read the current page title and URL when you open quick add |
| `scripting` | Read the icons and header logos already rendered in the current page during quick add; only active after an extension click or shortcut |
| `https://*/*`, `http://*/*` (optional) | Read a site's page and download its SVG / high-resolution icons when you add an automatic icon; download the daily wallpaper after you enable Bing daily |

Site access is requested once when you create or edit an automatic icon and then applies to all sites. Quick add never shows a site-access prompt: with access it uses the icons and header logos already rendered in the current tab, and without access it uses the browser's cached site icon. Reading a page reuses the browser's existing session for that site so login-only pages can still be resolved. The Bing permission is requested when you enable daily wallpaper. Both can be revoked at any time in the browser settings.

## Privacy

SunTab is local-first. Settings and navigation live in `chrome.storage.local`, uploaded images live in IndexedDB, and a small first-paint snapshot lives in `localStorage`. SunTab has no analytics, no accounts, and no background network requests.

SunTab contacts the network only when you enable Bing daily wallpaper, or when you add an automatic icon and read a site's page (reusing the browser's existing session for that site). Searches and icon links navigate only to the sites you choose. Automatic icons use the browser's cached site icon when no high-resolution icon is available or access is not granted, then the text initial if no cached icon exists.

## Good to know

- Chrome, Chromium, and Microsoft Edge on Manifest V3. Firefox is not supported.
- The interface is currently in Simplified Chinese.
- JSON backups include uploaded icon images but not wallpaper images. Wallpapers are device-local.
- Automatic icons resolve in this order: declared SVG → declared PNG / WebP of at least 96px → header brand image (preferring the independent mark) → mask SVG → the browser's cached site icon → text initial. SVG stays vector and bitmaps become 128px WebP; both are stored locally and included in JSON backups. Blank or solid-white images are skipped, and white-only artwork gets a dark backdrop.
- Uploaded and Bing wallpapers use light text. Very bright images may need a higher dim value for comfortable contrast.
- The last selected group is not remembered across reloads; SunTab returns to the first group.
- Web search suggestions, search history, bookmarks/history import, cloud sync, and a component store are intentionally out of scope.
- The pinyin dictionary loads on the first local search. Quick add works on `http` and `https` pages.
- Large icon sets scroll vertically; long group lists scroll in the sidebar.

## Development

```bash
pnpm compile     # type check
pnpm test        # unit tests (Vitest)
pnpm build       # production build
pnpm test:e2e    # Playwright; run pnpm build first
```

Playwright loads `.output/chrome-mv3`. If the bundled Chromium is not available, set `SUNTAB_CHROME=/path/to/chrome`. To run the same suite in Edge:

```bash
SUNTAB_CHROME="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" pnpm test:e2e
```

## Contact

WeChat official account: **十一营养师** (Shiyi Nutritionist).
