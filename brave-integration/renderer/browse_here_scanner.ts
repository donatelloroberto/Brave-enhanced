// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_scanner.ts
//
// IMPORTANT ARCHITECTURE NOTE:
// This script is injected into regular web page contexts via
// BrowseHereRenderFrameObserver::InjectScanner(). It runs in the main world
// (ISOLATED_WORLD_ID_GLOBAL) so it has full DOM access.
//
// It does NOT use Mojo directly — Mojo is browser/renderer IPC that isn't
// available in arbitrary web page contexts. Instead this script:
//   1. Scans the DOM for video sources
//   2. Stores results in window.__browseHereVideos (JSON-serialisable)
//   3. Exposes window.__browseHereRescan() so C++ can request a fresh scan
//
// The C++ observer reads window.__browseHereVideos via ExecuteJavaScript()
// and sends the data to the browser process over its own Mojo pipe.
//
// Build note: Compiled from TS to JS via the GN `ts_library` target in
// brave/components/browse_here/renderer/BUILD.gn, output bundled as
// IDR_BROWSE_HERE_SCANNER_JS via grit.

export interface DetectedVideo {
  url: string;
  type: 'mp4' | 'hls' | 'dash' | 'webm' | 'iframe' | 'unknown';
  title: string;
  quality?: string;
  duration?: number;
  thumbnail?: string;
  sourceHost: string;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function resolveUrl(src: string): string | null {
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return null;
  try {
    return new URL(src, document.baseURI).href;
  } catch {
    return null;
  }
}

function detectType(url: string): DetectedVideo['type'] {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.includes('.m3u8')) return 'hls';
  if (lower.includes('.mpd')) return 'dash';
  if (lower.endsWith('.webm')) return 'webm';
  if (lower.match(/\.(mp4|mov|avi|mkv)/)) return 'mp4';
  return 'unknown';
}

function guessQuality(url: string): string | undefined {
  const m = url.match(/(\d{3,4})[pP]/);
  return m ? m[1] + 'p' : undefined;
}

// -----------------------------------------------------------------------
// Core scanner — returns detected videos without any side-effects
// -----------------------------------------------------------------------

function scanPage(): DetectedVideo[] {
  const found = new Map<string, DetectedVideo>();
  const host = window.location.hostname;
  const pageTitle = document.title || window.location.href;

  function add(raw: string, overrides: Partial<DetectedVideo> = {}) {
    const url = resolveUrl(raw);
    if (!url || found.has(url)) return;
    const type = overrides.type ?? detectType(url);
    found.set(url, {
      url,
      type,
      title: overrides.title ?? pageTitle,
      quality: overrides.quality ?? guessQuality(url),
      duration: overrides.duration,
      thumbnail: overrides.thumbnail,
      sourceHost: host,
      ...overrides,
      // These always win — overrides may have supplied raw values above
      url,
      type,
      sourceHost: host,
    });
  }

  // 1. <video> elements and their <source> children
  document.querySelectorAll<HTMLVideoElement>('video').forEach(v => {
    const poster = v.poster || undefined;
    const dur = isFinite(v.duration) && !isNaN(v.duration) ? v.duration : undefined;
    const title = v.title || v.getAttribute('aria-label') || pageTitle;
    if (v.src) add(v.src, { title, thumbnail: poster, duration: dur });
    v.querySelectorAll<HTMLSourceElement>('source').forEach(s => {
      if (s.src) add(s.src, { title, thumbnail: poster, duration: dur });
    });
  });

  // 2. Standalone <source> tags not nested inside <video>
  document.querySelectorAll<HTMLSourceElement>('source[src]').forEach(s => {
    if (s.src) add(s.src);
  });

  // 3. Anchor links pointing directly to video files
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    if (/\.(mp4|webm|m3u8|mpd|mov|avi|mkv)(\?|$)/i.test(a.href)) {
      add(a.href, { title: a.textContent?.trim() || pageTitle });
    }
  });

  // 4. Iframes embedding known video platforms
  document.querySelectorAll<HTMLIFrameElement>('iframe[src], iframe[data-src]').forEach(f => {
    const src = f.src || f.dataset['src'];
    if (!src) return;
    const resolved = resolveUrl(src);
    if (!resolved) return;
    const isVideo =
      /youtube\.com|youtu\.be|vimeo\.com|dailymotion|twitch\.tv|facebook\.com\/video|\/embed\/|\/player\//i.test(resolved);
    if (isVideo) {
      add(resolved, { type: 'iframe', title: f.title || pageTitle });
    }
  });

  // 5. Inline script mining for hardcoded video URLs
  document.querySelectorAll('script:not([src])').forEach(s => {
    const content = s.textContent ?? '';
    const re = /["'`](https?:\/\/[^"'`\s]+\.(?:mp4|m3u8|mpd|webm)(?:\?[^"'`\s]*)?)["'`]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      add(m[1]);
    }
  });

  // 6. Open Graph video meta tags
  const ogVideo =
    (document.querySelector('meta[property="og:video"]') as HTMLMetaElement | null)?.content ||
    (document.querySelector('meta[property="og:video:url"]') as HTMLMetaElement | null)?.content;
  if (ogVideo) {
    const ogThumb =
      (document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null)?.content;
    const ogTitle =
      (document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null)?.content;
    add(ogVideo, { title: ogTitle || pageTitle, thumbnail: ogThumb });
  }

  return Array.from(found.values());
}

// -----------------------------------------------------------------------
// Public API — write results to window so C++ can read them back
// -----------------------------------------------------------------------

function runScanner(): void {
  const videos = scanPage();
  // Store as a plain JSON-serialisable array.
  // C++ reads: window.__browseHereVideos via ExecuteJavaScript callback.
  (window as any).__browseHereVideos = videos;
  // Also dispatch a CustomEvent so any future listener can react.
  window.dispatchEvent(
    new CustomEvent('browse-here-scan-complete', { detail: { videos } })
  );
}

// Exposed so C++ BrowseHereUI::ScanCurrentPage() can call:
//   frame->ExecuteJavaScript(u"window.__browseHereRescan()");
(window as any).__browseHereRescan = runScanner;

// -----------------------------------------------------------------------
// Auto-run on inject
// -----------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runScanner);
} else {
  runScanner();
}

// MutationObserver: re-scan when video elements are added dynamically.
// Debounced to 800ms to avoid flooding on heavy SPAs.
let scanTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(runScanner, 800);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: false,
});
