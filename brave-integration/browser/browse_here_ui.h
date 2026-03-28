// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/ui/webui/browse_here/browse_here_ui.h

#ifndef BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_
#define BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_

#include "brave/components/browse_here/common/browse_here.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace content {
class WebUI;
}  // namespace content

namespace browse_here {
class BrowseHereService;
}  // namespace browse_here

// ---------------------------------------------------------------------------
// BrowseHereUI  —  chrome://browse-here WebUI controller
//
// Entry points to wire up:
//   1. brave/components/constants/webui_url_constants.h
//        Add: kBrowseHereHost, kBrowseHereURL
//
//   2. brave/browser/ui/webui/brave_web_ui_controller_factory.cc
//        In GetWebUIFactoryFunction(), add:
//          if (url.host() == kBrowseHereHost) {
//            return &NewWebUI<BrowseHereUI>;
//          }
//        Also add include at top:
//          #include "brave/browser/ui/webui/browse_here/browse_here_ui.h"
//
//   3. renderer/brave_content_renderer_client.cc  (see .patch file)
//        Instantiate BrowseHereRenderFrameObserver in RenderFrameCreated().
// ---------------------------------------------------------------------------

class BrowseHereUI : public ui::MojoWebUIController,
                     public brave_browse_here::mojom::BrowseHerePageHandler {
 public:
  explicit BrowseHereUI(content::WebUI* web_ui);
  BrowseHereUI(const BrowseHereUI&) = delete;
  BrowseHereUI& operator=(const BrowseHereUI&) = delete;
  ~BrowseHereUI() override;

  // Called by the WebUI page to establish the Mojo pipe.
  void BindInterface(
      mojo::PendingReceiver<brave_browse_here::mojom::BrowseHerePageHandler>
          receiver);

  // ---------------------------------------------------------------------------
  // brave_browse_here::mojom::BrowseHerePageHandler
  // ---------------------------------------------------------------------------
  void SetPage(mojo::PendingRemote<brave_browse_here::mojom::BrowseHerePage>
                   page) override;
  void GetPlaylist(GetPlaylistCallback callback) override;
  void AddToPlaylist(brave_browse_here::mojom::VideoSourcePtr video,
                     AddToPlaylistCallback callback) override;
  void RemoveFromPlaylist(int32_t id,
                          RemoveFromPlaylistCallback callback) override;
  void GetDetectedVideos(GetDetectedVideosCallback callback) override;
  void ScanCurrentPage() override;

 private:
  // Returns BrowseHereService for the current profile. Non-null after the
  // KeyedService factory is registered at startup.
  browse_here::BrowseHereService* GetService();

  mojo::Receiver<brave_browse_here::mojom::BrowseHerePageHandler>
      page_handler_receiver_{this};

  WEB_UI_CONTROLLER_TYPE_DECL();
};

#endif  // BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_
