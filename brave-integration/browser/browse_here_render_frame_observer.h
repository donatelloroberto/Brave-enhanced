// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_render_frame_observer.h
//
// Architecture:
//   - Lives in the RENDERER process, created per-frame in
//     BraveContentRendererClient::RenderFrameCreated().
//   - On DidCreateNewDocument (HTTP/HTTPS only) it injects browse_here_scanner.js.
//   - On DidFinishLoad it reads window.__browseHereVideos via ExecuteJavaScript
//     and sends the parsed result to the browser process via BrowseHereHost Mojo.
//   - The Mojo pipe to BrowseHereHost is bound in the constructor.

#ifndef BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_
#define BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_

#include <string>
#include <string_view>

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

  // content::RenderFrameObserver
  void DidCreateNewDocument() override;
  void DidFinishLoad() override;
  void OnDestruct() override;

 private:
  // Injects the compiled scanner JS bundle into the page's main world.
  void InjectScanner();

  // Reads window.__browseHereVideos from JS, parses it, and calls
  // host_remote_->OnVideosDetected() with the result.
  void ReadAndReportVideos();

  // Callback called by ExecuteJavaScript when the JS expression result is ready.
  void OnVideosJsonReady(std::u16string json_result);

  // Mojo remote to BrowseHereHost in the browser process.
  // Bound in the constructor via GetBrowserInterfaceBroker.
  mojo::Remote<brave_browse_here::mojom::BrowseHereHost> host_remote_;
};

}  // namespace browse_here

#endif  // BRAVE_COMPONENTS_BROWSE_HERE_RENDERER_BROWSE_HERE_RENDER_FRAME_OBSERVER_H_
