// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/ui/webui/browse_here/browse_here_ui.h

#ifndef BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_
#define BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_

#include "brave/components/browse_here/common/browse_here.mojom.h"
#include "content/public/browser/web_ui_controller.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "ui/webui/mojo_web_ui_controller.h"

namespace content {
class WebUI;
}

// ---------------------------------------------------------------------------
// BrowseHereUI
//
// Controls the brave://browse-here WebUI page.
// It bridges the React frontend to BrowseHereService.
//
// Registration:
//   Add to chrome/browser/ui/webui/chrome_web_ui_controller_factory.cc
//   and brave/browser/ui/webui/brave_web_ui_controller_factory.cc
//
// URL: brave://browse-here
// ---------------------------------------------------------------------------

class BrowseHereUI : public ui::MojoWebUIController,
                     public brave_browse_here::mojom::BrowseHerePageHandler {
 public:
  explicit BrowseHereUI(content::WebUI* web_ui);
  BrowseHereUI(const BrowseHereUI&) = delete;
  BrowseHereUI& operator=(const BrowseHereUI&) = delete;
  ~BrowseHereUI() override;

  // Called by the WebUI page to set up the Mojo pipe.
  void BindInterface(
      mojo::PendingReceiver<brave_browse_here::mojom::BrowseHerePageHandler>
          receiver);

  // ---------------------------------------------------------------------------
  // BrowseHerePageHandler (Mojo)
  // ---------------------------------------------------------------------------
  void GetPlaylist(GetPlaylistCallback callback) override;
  void AddToPlaylist(brave_browse_here::mojom::VideoSourcePtr video,
                     AddToPlaylistCallback callback) override;
  void RemoveFromPlaylist(int32_t id,
                          RemoveFromPlaylistCallback callback) override;
  void GetDetectedVideos(GetDetectedVideosCallback callback) override;
  void ScanCurrentPage() override;

 private:
  mojo::Receiver<brave_browse_here::mojom::BrowseHerePageHandler>
      page_handler_receiver_{this};

  WEB_UI_CONTROLLER_TYPE_DECL();
};

#endif  // BRAVE_BROWSER_UI_WEBUI_BROWSE_HERE_BROWSE_HERE_UI_H_
