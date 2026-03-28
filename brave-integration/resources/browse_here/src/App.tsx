// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/resources/browse_here/src/App.tsx
//
// Root component for the brave://browse-here WebUI page.
// This is essentially the same layout as artifacts/tcl-player/src/App.tsx
// except:
//   - No wouter Router (WebUI has no client-side routing)
//   - All data fetching uses browse_here_api.ts (Mojo) instead of /api/* HTTP
//   - usePlayerStore uses Mojo events for real-time video detection updates

import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PlaylistSidebar } from '@/components/playlist-sidebar';
import { VideoPlayer } from '@/components/video-player';
import { UrlScanner } from '@/components/url-scanner';
import { usePlayerStore } from '@/store/use-player-store';
import { onVideosDetected, getDetectedVideos } from './browse_here_api';
import type { VideoSource } from './browse_here_api';

// ---------------------------------------------------------------------------
// Hydrate store from the browser-process detected videos on mount,
// and subscribe to live updates pushed by the scanner.
// ---------------------------------------------------------------------------
function useMojoBridge() {
  const { setDetectedVideos, setPageTitle } = usePlayerStore();

  useEffect(() => {
    // Load any already-detected videos (active tab may have been scanned)
    getDetectedVideos().then(({ videos, pageTitle }) => {
      if (videos.length > 0) {
        setDetectedVideos(
          videos.map((v: VideoSource) => ({
            url: v.url,
            type: v.type as any,
            title: v.title,
            quality: v.quality ?? undefined,
            duration: v.duration ?? undefined,
            thumbnail: v.thumbnail ?? undefined,
            sourceHost: v.sourceHost,
          }))
        );
        setPageTitle(pageTitle);
      }
    });

    // Subscribe to live updates from the renderer scanner
    const unsub = onVideosDetected((videos, pageTitle) => {
      setDetectedVideos(
        videos.map((v: VideoSource) => ({
          url: v.url,
          type: v.type as any,
          title: v.title,
          quality: v.quality ?? undefined,
          duration: v.duration ?? undefined,
          thumbnail: v.thumbnail ?? undefined,
          sourceHost: v.sourceHost,
        }))
      );
      setPageTitle(pageTitle);
    });

    return unsub;
  }, [setDetectedVideos, setPageTitle]);
}

// ---------------------------------------------------------------------------
// In WebUI mode the UrlScanner still works for manual URL entry, but the
// primary flow is automatic detection from the active tab via Mojo.
// ---------------------------------------------------------------------------

export default function App() {
  useMojoBridge();

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
        {/* Top bar — URL scanner */}
        <header className="flex-none border-b border-border bg-card/50 backdrop-blur-sm px-4 py-2">
          <UrlScanner />
        </header>

        {/* Body — sidebar + player */}
        <div className="flex-1 flex overflow-hidden">
          <PlaylistSidebar />
          <main className="flex-1 overflow-hidden">
            <VideoPlayer />
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
