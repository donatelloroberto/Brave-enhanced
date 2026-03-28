// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_render_frame_observer.h
//
// This class lives in the RENDERER process. It is created for every
// RenderFrame and:
//   1. Injects the browse_here_scanner.js content script into non-WebUI pages.
//   2. Holds the Mojo remote to BrowseHereHost (browser process).
//   3. Exposes window.__browseHereRescan() so ScanCurrentPage() can trigger
//      a fresh scan without reloading.

#ifndef BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_
#define BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_

#include "brave/components/browse_here/common/browse_here.mojom.h"
#include "content/public/renderer/render_frame.h"
#include "content/public/renderer/render_frame_observer.h"
#include "mojo/public/cpp/bindings/remote.h"

namespace browse_here {

class BrowseHereRenderFrameObserver : public content::RenderFrameObserver {
 public:
  explicit BrowseHereRenderFrameObserver(content::RenderFrame* render_frame);
  BrowseHereRenderFrameObserver(const BrowseHereRenderFrameObserver&) = delete;
  BrowseHereRenderFrameObserver& operator=(
      const BrowseHereRenderFrameObserver&) = delete;
  ~BrowseHereRenderFrameObserver() override;

  // RenderFrameObserver
  void DidCreateNewDocument() override;
  void DidFinishLoad() override;
  void OnDestruct() override;

 private:
  void InjectScanner();

  mojo::Remote<brave_browse_here::mojom::BrowseHereHost> host_remote_;
};

}  // namespace browse_here

#endif  // BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_
