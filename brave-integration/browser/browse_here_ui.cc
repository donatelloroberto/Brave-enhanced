// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/ui/webui/browse_here/browse_here_ui.cc

#include "brave/browser/ui/webui/browse_here/browse_here_ui.h"

#include <utility>

#include "brave/browser/browse_here/browse_here_service_factory.h"
#include "brave/browser/ui/webui/brave_webui_source.h"
#include "brave/components/browse_here/browser/browse_here_service.h"
#include "brave/components/constants/webui_url_constants.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_finder.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_data_source.h"
#include "grit/brave_browse_here_resources.h"

namespace {

// Matches entries in brave/browser/resources/browse_here/browse_here_resources.grd
// and the corresponding IDR_ constants generated into grit/brave_browse_here_resources.h
constexpr webui::ResourcePath kBrowseHereResources[] = {
    {"browse_here.html", IDR_BROWSE_HERE_HTML},
    {"browse_here.js",   IDR_BROWSE_HERE_JS},
    {"browse_here.css",  IDR_BROWSE_HERE_CSS},
};

}  // namespace

WEB_UI_CONTROLLER_TYPE_IMPL(BrowseHereUI)

BrowseHereUI::BrowseHereUI(content::WebUI* web_ui)
    : ui::MojoWebUIController(web_ui, /*enable_chrome_send=*/true) {
  // Use Brave's CreateAndAddWebUIDataSource helper — handles CSP, adds resource
  // paths, and registers the data source with the browser context.
  CreateAndAddWebUIDataSource(web_ui, kBrowseHereHost, kBrowseHereResources,
                              IDR_BROWSE_HERE_HTML);
}

BrowseHereUI::~BrowseHereUI() = default;

void BrowseHereUI::BindInterface(
    mojo::PendingReceiver<brave_browse_here::mojom::BrowseHerePageHandler>
        receiver) {
  page_handler_receiver_.reset();
  page_handler_receiver_.Bind(std::move(receiver));
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

browse_here::BrowseHereService* BrowseHereUI::GetService() {
  Profile* profile = Profile::FromWebUI(web_ui());
  return BrowseHereServiceFactory::GetForProfile(profile);
}

// ---------------------------------------------------------------------------
// BrowseHerePageHandler Mojo implementations
// ---------------------------------------------------------------------------

void BrowseHereUI::SetPage(
    mojo::PendingRemote<brave_browse_here::mojom::BrowseHerePage> page) {
  GetService()->SetPageRemote(std::move(page));
}

void BrowseHereUI::GetPlaylist(GetPlaylistCallback callback) {
  GetService()->GetPlaylist(std::move(callback));
}

void BrowseHereUI::AddToPlaylist(
    brave_browse_here::mojom::VideoSourcePtr video,
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
  Browser* browser = chrome::FindLastActive();
  if (!browser) return;

  content::WebContents* web_contents =
      browser->tab_strip_model()->GetActiveWebContents();
  if (!web_contents) return;

  // Trigger window.__browseHereRescan() on the active tab.
  // This runs in the main world where the injected scanner lives.
  web_contents->GetPrimaryMainFrame()->ExecuteJavaScript(
      u"window.__browseHereRescan && window.__browseHereRescan();",
      base::NullCallback());
}
