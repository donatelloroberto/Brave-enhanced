// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/resources/browse_here/src/browse_here_api.ts
//
// This file wraps the Mojo interface so the React components never
// talk to Mojo directly. The rest of the UI uses this API layer only.

import {
  BrowseHerePageHandler,
  BrowseHerePageHandlerRemote,
  BrowseHerePage,
  BrowseHerePageCallbackRouter,
  VideoSource,
  PlaylistEntry,
} from '../mojom-webui/browse_here.mojom-webui.js';

export type { VideoSource, PlaylistEntry };

// -----------------------------------------------------------------------
// Singleton handler remote (browser-process bridge)
// -----------------------------------------------------------------------

let handlerInstance: BrowseHerePageHandlerRemote | null = null;
let callbackRouter: BrowseHerePageCallbackRouter | null = null;

export function getHandler(): BrowseHerePageHandlerRemote {
  if (!handlerInstance) {
    handlerInstance = BrowseHerePageHandler.getRemote();
  }
  return handlerInstance;
}

export function getCallbackRouter(): BrowseHerePageCallbackRouter {
  if (!callbackRouter) {
    callbackRouter = new BrowseHerePageCallbackRouter();
    getHandler().setPage(callbackRouter.$.bindNewPipeAndPassRemote());
  }
  return callbackRouter;
}

// -----------------------------------------------------------------------
// Typed API surface consumed by React components
// -----------------------------------------------------------------------

export async function getPlaylist(): Promise<PlaylistEntry[]> {
  const { entries } = await getHandler().getPlaylist();
  return entries;
}

export async function addToPlaylist(video: VideoSource): Promise<PlaylistEntry> {
  const { entry } = await getHandler().addToPlaylist(video);
  return entry;
}

export async function removeFromPlaylist(id: number): Promise<boolean> {
  const { success } = await getHandler().removeFromPlaylist(id);
  return success;
}

export async function getDetectedVideos(): Promise<{
  videos: VideoSource[];
  pageTitle: string;
}> {
  const { videos, pageTitle } = await getHandler().getDetectedVideos();
  return { videos, pageTitle };
}

export function scanCurrentPage(): void {
  getHandler().scanCurrentPage();
}

// -----------------------------------------------------------------------
// Event subscriptions (push from browser → WebUI)
// -----------------------------------------------------------------------

type VideosDetectedHandler = (
  videos: VideoSource[],
  pageTitle: string,
  pageUrl: string
) => void;

export function onVideosDetected(handler: VideosDetectedHandler): () => void {
  const listenerId = getCallbackRouter().onVideosDetected.addListener(handler);
  return () => getCallbackRouter().onVideosDetected.removeListener(listenerId);
}
