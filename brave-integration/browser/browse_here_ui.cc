// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/ui/webui/browse_here/browse_here_ui.cc

#include "brave/browser/ui/webui/browse_here/browse_here_ui.h"

#include <utility>

#include "brave/browser/brave_browser_process.h"
#include "brave/browser/browse_here/browse_here_service_factory.h"
#include "brave/components/browse_here/browser/browse_here_service.h"
#include "brave/components/browse_here/common/url_constants.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "content/public/browser/browser_context.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "grit/brave_browse_here_resources.h"

namespace {

content::WebUIDataSource* CreateBrowseHereDataSource() {
  content::WebUIDataSource* source =
      content::WebUIDataSource::Create(kBrowseHereHost);

  // Add all built resources (from grit)
  source->AddResourcePaths(kBrowseHereResources);
  source->SetDefaultResource(IDR_BROWSE_HERE_HTML);

  // Security: allow the page to use the mojo bindings
  source->OverrideContentSecurityPolicy(
      network::mojom::CSPDirectiveName::ScriptSrc,
      "script-src 'self' chrome://resources;");

  return source;
}

}  // namespace

WEB_UI_CONTROLLER_TYPE_IMPL(BrowseHereUI)

BrowseHereUI::BrowseHereUI(content::WebUI* web_ui)
    : ui::MojoWebUIController(web_ui, true) {
  Profile* profile = Profile::FromWebUI(web_ui);
  content::WebUIDataSource::Add(profile, CreateBrowseHereDataSource());
}

BrowseHereUI::~BrowseHereUI() = default;

void BrowseHereUI::BindInterface(
    mojo::PendingReceiver<brave_browse_here::mojom::BrowseHerePageHandler>
        receiver) {
  page_handler_receiver_.reset();
  page_handler_receiver_.Bind(std::move(receiver));
}

// ---------------------------------------------------------------------------
// BrowseHerePageHandler implementations — delegates to BrowseHereService
// ---------------------------------------------------------------------------

browse_here::BrowseHereService* BrowseHereUI::GetService() {
  Profile* profile = Profile::FromWebUI(web_ui());
  return BrowseHereServiceFactory::GetForProfile(profile);
}

void BrowseHereUI::GetPlaylist(GetPlaylistCallback callback) {
  GetService()->GetPlaylist(std::move(callback));
}

void BrowseHereUI::AddToPlaylist(brave_browse_here::mojom::VideoSourcePtr video,
                                  AddToPlaylistCallback callback) {
  GetService()->AddToPlaylist(std::move(video), std::move(callback));
}

void BrowseHereUI::RemoveFromPlaylist(int32_t id,
                                       RemoveFromPlaylistCallback callback) {
  GetService()->RemoveFromPlaylist(id, std::move(callback));
}

void BrowseHereUI::GetDetectedVideos(GetDetectedVideosCallback callback) {
  auto videos = GetService()->GetDetectedVideos();
  const auto& title = GetService()->GetDetectedPageTitle();
  std::move(callback).Run(std::move(videos), title);
}

void BrowseHereUI::ScanCurrentPage() {
  // Find the active tab and send a re-scan message to the renderer
  Browser* browser = chrome::FindLastActive();
  if (!browser) return;

  content::WebContents* web_contents =
      browser->tab_strip_model()->GetActiveWebContents();
  if (!web_contents) return;

  // The renderer scanner is always injected; we just ask it to re-run.
  web_contents->GetPrimaryMainFrame()->ExecuteJavaScriptInIsolatedWorld(
      u"window.__browseHereRescan && window.__browseHereRescan();",
      base::NullCallback(),
      content::ISOLATED_WORLD_ID_CONTENT_END);
}
