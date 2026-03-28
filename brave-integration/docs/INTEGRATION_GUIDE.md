# BrowseHere — Brave Core Integration Guide

## What This Feature Does

BrowseHere adds a built-in streaming video player to Brave that:
- **Automatically detects** video sources on every webpage you visit (MP4, HLS, DASH, WebM, iframe embeds)
- **Surfaces a playlist** of all detected videos in a native `brave://browse-here` page
- **Plays them** in a custom full-screen HTML5 player with TCL TV-style controls
- **Persists** your saved playlist to your browser profile on disk (survives restarts)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS (one per tab)                                   │
│                                                                   │
│  BrowseHereRenderFrameObserver                                    │
│    ↳ Injects browse_here_scanner.ts into every HTTP/HTTPS page   │
│    ↳ Scanner scans DOM, script tags, og:video meta               │
│    ↳ Sends detected videos → BrowseHereHost (Mojo) ────────────┐ │
└────────────────────────────────────────────────────────────────┼─┘
                                                                 │
                            Mojo IPC                             │
                                                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  BROWSER PROCESS                                                  │
│                                                                   │
│  BrowseHereService  (KeyedService — one per profile)             │
│    ↳ Stores detected videos in memory                            │
│    ↳ Persists playlist to BrowseHerePlaylist.json in profile dir │
│    ↳ Pushes events to the WebUI page via BrowseHerePage (Mojo)  │
│                                                                   │
│  BrowseHereUI  (brave://browse-here WebUI controller)            │
│    ↳ Hosts the React frontend                                    │
│    ↳ Implements BrowseHerePageHandler (Mojo) ← frontend calls   │
└──────────────────────────────────────────────────────────────────┘
                        │
                 React (TypeScript)
                        │
             brave://browse-here  (Chromium WebUI)
```

---

## Files & Where They Go

| This file | Drop into Brave repo |
|-----------|---------------------|
| `common/browse_here.mojom` | `brave/components/browse_here/common/` |
| `renderer/browse_here_scanner.ts` | `brave/components/browse_here/renderer/` |
| `browser/browse_here_render_frame_observer.{h,cc}` | `brave/components/browse_here/renderer/` |
| `browser/browse_here_service.{h,cc}` | `brave/components/browse_here/browser/` |
| `browser/browse_here_service_factory.{h,cc}` | `brave/browser/browse_here/` |
| `browser/browse_here_ui.{h,cc}` | `brave/browser/ui/webui/browse_here/` |
| `browser/BUILD.gn` | Use as reference; merge into respective `BUILD.gn` files |
| `resources/browse_here/src/` | `brave/browser/resources/browse_here/` |
| `resources/browse_here/package.json` | `brave/browser/resources/browse_here/` |

---

## Step-by-Step Integration

### Step 1 — Add the Mojo interface

```bash
# Copy the .mojom file
cp brave-integration/common/browse_here.mojom \
   src/brave/components/browse_here/common/

# Add to brave/components/browse_here/common/BUILD.gn:
mojom("browse_here_mojo") {
  sources = [ "browse_here.mojom" ]
}
```

### Step 2 — Add the renderer component

```bash
cp brave-integration/renderer/browse_here_scanner.ts \
   src/brave/components/browse_here/renderer/

cp brave-integration/browser/browse_here_render_frame_observer.{h,cc} \
   src/brave/components/browse_here/renderer/
```

Create `brave/components/browse_here/renderer/browse_here_renderer_resources.grd`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<grit latest_public_release="0" current_release="1">
  <outputs>
    <output filename="grit/brave_browse_here_renderer_resources.h" type="rc_header"/>
    <output filename="brave_browse_here_renderer_resources.pak" type="data_package"/>
  </outputs>
  <release seq="1">
    <includes>
      <include name="IDR_BROWSE_HERE_SCANNER_JS"
               file="browse_here_scanner.js" type="BINDATA"/>
    </includes>
  </release>
</grit>
```

Register the observer in your renderer content client:
```cpp
// In brave/renderer/brave_content_renderer_client.cc
void BraveContentRendererClient::RenderFrameCreated(
    content::RenderFrame* render_frame) {
  // ... existing code ...
  new browse_here::BrowseHereRenderFrameObserver(render_frame);
}
```

### Step 3 — Add the browser KeyedService

```bash
cp brave-integration/browser/browse_here_service.{h,cc} \
   src/brave/components/browse_here/browser/

cp brave-integration/browser/browse_here_service_factory.{h,cc} \
   src/brave/browser/browse_here/
```

Register in `BraveBrowserMainExtraParts` (or equivalent startup hook):
```cpp
BrowseHereServiceFactory::GetInstance();  // ensures it's registered
```

### Step 4 — Register the WebUI page

```bash
cp brave-integration/browser/browse_here_ui.{h,cc} \
   src/brave/browser/ui/webui/browse_here/
```

Add the URL constant in `brave/common/url_constants.h`:
```cpp
inline constexpr char kBrowseHereHost[] = "browse-here";
inline constexpr char kBrowseHereURL[]  = "brave://browse-here";
```

Register in `brave/browser/ui/webui/brave_web_ui_controller_factory.cc`:
```cpp
if (url.host() == kBrowseHereHost) {
  return std::make_unique<BrowseHereUI>(web_ui);
}
```

### Step 5 — Build the React frontend

```bash
cd brave-integration/resources/browse_here
npm install

# During development — hot reload against a local Chromium build:
npm run dev

# For production (GN integrates this via the grit target):
npm run build
# Then add output files to the .grd resource file
```

Copy the built UI:
```bash
cp -r brave-integration/resources/browse_here/src \
      src/brave/browser/resources/browse_here/
```

Create `brave/browser/resources/browse_here/browse_here_resources.grd`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<grit latest_public_release="0" current_release="1">
  <outputs>
    <output filename="grit/brave_browse_here_resources.h" type="rc_header"/>
    <output filename="brave_browse_here_resources.pak" type="data_package"/>
  </outputs>
  <release seq="1">
    <includes>
      <include name="IDR_BROWSE_HERE_HTML"
               file="browse_here.html" flattenhtml="true" type="BINDATA"/>
      <include name="IDR_BROWSE_HERE_JS"
               file="browse_here.js" type="BINDATA"/>
      <include name="IDR_BROWSE_HERE_CSS"
               file="browse_here.css" type="BINDATA"/>
    </includes>
  </release>
</grit>
```

### Step 6 — Compile

```bash
# From brave-browser repo root:
npm run sync  # pull matching Chromium

# Generate build files
gn gen out/Default --args='is_debug=false is_component_build=true'

# Incremental build (only recompile changed components):
ninja -C out/Default brave/components/browse_here:browse_here_browser
ninja -C out/Default brave/components/browse_here:browse_here_renderer
ninja -C out/Default brave/browser/ui/webui/browse_here:browse_here_webui

# Full build
ninja -C out/Default brave
```

### Step 7 — Test

1. Launch `out/Default/brave`
2. Navigate to any video-hosting page (YouTube embed, MP4 link, etc.)
3. Open a new tab → type `brave://browse-here`
4. You should see detected videos from the previous tab listed automatically
5. Click a video to play it in the built-in player

---

## Key Concepts

### Mojo IPC Flow (Renderer → Browser)
```
Tab loads page
  → BrowseHereRenderFrameObserver::DidCreateNewDocument()
    → Injects browse_here_scanner.js
      → Scanner finds <video> tags, <source> tags, og:video, script mining
        → BrowseHereHost::OnVideosDetected() [Mojo call]
          → BrowseHereService stores + pushes to WebUI
            → brave://browse-here React app updates live
```

### Mojo IPC Flow (WebUI → Browser → Renderer)
```
User clicks "Scan Current Tab" in brave://browse-here
  → BrowseHerePageHandler::ScanCurrentPage() [Mojo call]
    → BrowseHereUI::ScanCurrentPage()
      → Finds active tab's WebContents
        → Calls window.__browseHereRescan() via ExecuteJavaScript
          → Scanner re-runs → results come back via OnVideosDetected
```

### Playlist Persistence
- Stored as `BrowseHerePlaylist.json` in the user's profile directory
- Written asynchronously on a background thread via `base::ThreadPool`
- Loaded synchronously at service creation (before any UI opens)

---

## Adding a Toolbar Button

To add a one-click toolbar button that opens `brave://browse-here`:

```cpp
// In brave/browser/ui/toolbar/brave_toolbar_model.cc
// Add a BraveActionId for BrowseHere and wire it to:
chrome::NavigateParams params(browser, GURL(kBrowseHereURL),
                               ui::PAGE_TRANSITION_AUTO_BOOKMARK);
params.disposition = WindowOpenDisposition::NEW_FOREGROUND_TAB;
chrome::Navigate(&params);
```

---

## Notes

- The standalone web app (`artifacts/tcl-player`) uses HTTP `/api/detect` for URL scanning via the server. In the Brave build, URL scanning comes from the **renderer injection** automatically — no server needed.
- The web app's `url-scanner.tsx` component still works in the native build for manual URL entry, using the same `/api/detect` backend which can be wired through Mojo to the browser's `BrowseHereService`.
- For HLS (`.m3u8`) streams: `hls.js` is bundled in the WebUI React build. It runs entirely in the browser's renderer — no native C++ HLS parser needed.
