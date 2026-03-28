// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_scanner.ts
//
// This script is injected into every renderer by BrowseHereContentScriptManager.
// It scans the page DOM for video sources and reports them back to the
// browser process via the BrowseHereHost Mojo interface.
//
// Build note: compile via the brave/components/browse_here/renderer/BUILD.gn
// target and bundle with webpack alongside the other renderer JS components.

import { BrowseHereHost, VideoSource } from '../common/browse_here.mojom-webui.js';

interface DetectedVideo {
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
  if (lower.includes('.mpd'))  return 'dash';
  if (lower.endsWith('.webm')) return 'webm';
  if (lower.match(/\.(mp4|mov|avi|mkv)/)) return 'mp4';
  return 'unknown';
}

function guessQuality(url: string): string | undefined {
  const m = url.match(/(\d{3,4})[pP]/);
  return m ? m[1] + 'p' : undefined;
}

// -----------------------------------------------------------------------
// Core scanner
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
      url,             // ensure resolved URL wins
      type,
      sourceHost: host,
    });
  }

  // 1. <video> elements and their <source> children
  document.querySelectorAll<HTMLVideoElement>('video').forEach(v => {
    const poster = v.poster || undefined;
    const dur = isNaN(v.duration) ? undefined : v.duration;
    const title = v.title || v.getAttribute('aria-label') || pageTitle;
    if (v.src) add(v.src, { title, thumbnail: poster, duration: dur });
    v.querySelectorAll<HTMLSourceElement>('source').forEach(s => {
      if (s.src) add(s.src, { title, thumbnail: poster, duration: dur });
    });
  });

  // 2. Standalone <source> tags
  document.querySelectorAll<HTMLSourceElement>('source[src]').forEach(s => {
    if (s.src) add(s.src);
  });

  // 3. Anchor links pointing to video files
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    if (/\.(mp4|webm|m3u8|mpd|mov|avi|mkv)(\?|$)/i.test(a.href)) {
      add(a.href, { title: a.textContent?.trim() || pageTitle });
    }
  });

  // 4. Iframes embedding known video platforms
  document.querySelectorAll<HTMLIFrameElement>('iframe[src], iframe[data-src]').forEach(f => {
    const src = f.src || f.dataset.src;
    if (!src) return;
    const resolved = resolveUrl(src);
    if (!resolved) return;
    const isVideo =
      /youtube\.com|youtu\.be|vimeo\.com|dailymotion|twitch\.tv|facebook\.com\/video|\/embed\/|\/player\//i.test(resolved);
    if (isVideo) {
      add(resolved, {
        type: 'iframe',
        title: f.title || pageTitle,
      });
    }
  });

  // 5. Inline script mining for video URLs
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
    (document.querySelector('meta[property="og:video"]') as HTMLMetaElement)?.content ||
    (document.querySelector('meta[property="og:video:url"]') as HTMLMetaElement)?.content;
  if (ogVideo) {
    const ogThumb =
      (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content;
    const ogTitle =
      (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content;
    add(ogVideo, { title: ogTitle || pageTitle, thumbnail: ogThumb });
  }

  return Array.from(found.values());
}

// -----------------------------------------------------------------------
// Mojo communication
// -----------------------------------------------------------------------

let host: BrowseHereHost | null = null;

function getHost(): BrowseHereHost {
  if (!host) {
    host = BrowseHereHost.getRemote();
  }
  return host;
}

function toMojoVideoSource(v: DetectedVideo): VideoSource {
  return {
    url: v.url,
    type: v.type,
    title: v.title,
    quality: v.quality ?? null,
    duration: v.duration ?? null,
    thumbnail: v.thumbnail ?? null,
    sourceHost: v.sourceHost,
  };
}

function reportVideos(videos: DetectedVideo[]): void {
  if (videos.length === 0) return;
  const mojoSources = videos.map(toMojoVideoSource);
  getHost().onVideosDetected(mojoSources, document.title, window.location.href);
}

// -----------------------------------------------------------------------
// Entry point — called once the DOM is ready
// -----------------------------------------------------------------------

function runScanner(): void {
  const videos = scanPage();
  reportVideos(videos);
}

// Run immediately on inject, then watch for dynamic content changes
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runScanner);
} else {
  runScanner();
}

// MutationObserver: re-scan when new video elements are added dynamically
// (debounced to avoid flooding)
let scanTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    const videos = scanPage();
    reportVideos(videos);
  }, 800);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: false,
});
