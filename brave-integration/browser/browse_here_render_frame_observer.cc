// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_render_frame_observer.cc

#include "brave/components/browse_here/renderer/browse_here_render_frame_observer.h"

#include <utility>
#include <string_view>

#include "base/json/json_reader.h"
#include "base/logging.h"
#include "base/strings/utf_string_conversions.h"
#include "base/values.h"
#include "content/public/renderer/render_frame.h"
#include "third_party/blink/public/web/web_local_frame.h"
#include "third_party/blink/public/web/web_script_source.h"
#include "ui/base/resource/resource_bundle.h"
#include "grit/brave_browse_here_renderer_resources.h"

namespace browse_here {

BrowseHereRenderFrameObserver::BrowseHereRenderFrameObserver(
    content::RenderFrame* render_frame)
    : RenderFrameObserver(render_frame) {
  // Bind the Mojo remote to BrowseHereHost in the browser process.
  // This is safe to call from the renderer constructor.
  render_frame->GetBrowserInterfaceBroker().GetInterface(
      host_remote_.BindNewPipeAndPassReceiver());
}

BrowseHereRenderFrameObserver::~BrowseHereRenderFrameObserver() = default;

void BrowseHereRenderFrameObserver::DidCreateNewDocument() {
  // Only inject into the main frame of regular HTTP/HTTPS pages.
  if (!render_frame()->IsMainFrame()) return;
  const GURL url = GURL(
      render_frame()->GetWebFrame()->GetDocument().Url().GetString().Utf8());
  if (!url.SchemeIsHTTPOrHTTPS()) return;

  InjectScanner();
}

void BrowseHereRenderFrameObserver::DidFinishLoad() {
  // After the full page load, read any videos the scanner found.
  if (!render_frame()->IsMainFrame()) return;
  const GURL url = GURL(
      render_frame()->GetWebFrame()->GetDocument().Url().GetString().Utf8());
  if (!url.SchemeIsHTTPOrHTTPS()) return;

  ReadAndReportVideos();
}

void BrowseHereRenderFrameObserver::OnDestruct() {
  delete this;
}

void BrowseHereRenderFrameObserver::InjectScanner() {
  // The scanner JS is bundled as IDR_BROWSE_HERE_SCANNER_JS via grit.
  // It is injected into the page's main world so it has full DOM access.
  std::string_view scanner_js =
      ui::ResourceBundle::GetSharedInstance().GetRawDataResource(
          IDR_BROWSE_HERE_SCANNER_JS);

  render_frame()->GetWebFrame()->ExecuteScript(
      blink::WebScriptSource(
          blink::WebString::FromUTF8(scanner_js)));
}

void BrowseHereRenderFrameObserver::ReadAndReportVideos() {
  // Ask JS to serialize window.__browseHereVideos to a JSON string.
  // ExecuteJavaScript calls our callback asynchronously on the same thread.
  render_frame()->GetWebFrame()->RequestExecuteScript(
      content::ISOLATED_WORLD_ID_GLOBAL,
      {blink::WebScriptSource(
           u"JSON.stringify(window.__browseHereVideos || [])")},
      blink::mojom::UserActivationOption::kDoNotActivate,
      blink::mojom::EvaluationTiming::kSynchronous,
      blink::mojom::LoadEventBlockingOption::kDoNotBlock,
      base::BindOnce(&BrowseHereRenderFrameObserver::OnVideosJsonReady,
                     base::Unretained(this)),
      blink::BackForwardCacheAware::kAllow,
      blink::mojom::WantResultOption::kWantResult,
      blink::mojom::PromiseResultOption::kDoNotWait);
}

void BrowseHereRenderFrameObserver::OnVideosJsonReady(
    std::u16string json_result) {
  if (json_result.empty() || !host_remote_.is_bound()) return;

  const std::string utf8 = base::UTF16ToUTF8(json_result);
  auto parsed = base::JSONReader::Read(utf8);
  if (!parsed || !parsed->is_list()) {
    VLOG(1) << "[BrowseHere] Could not parse video list from renderer";
    return;
  }

  std::vector<brave_browse_here::mojom::VideoSourcePtr> sources;
  const std::string page_title =
      render_frame()->GetWebFrame()->GetDocument().Title().Utf8();
  const std::string page_url =
      render_frame()->GetWebFrame()->GetDocument().Url().GetString().Utf8();

  for (const auto& item : parsed->GetList()) {
    if (!item.is_dict()) continue;
    const auto& d = item.GetDict();

    auto src = brave_browse_here::mojom::VideoSource::New();
    src->url         = d.FindString("url") ? *d.FindString("url") : "";
    src->type        = d.FindString("type") ? *d.FindString("type") : "unknown";
    src->title       = d.FindString("title") ? *d.FindString("title") : page_title;
    src->source_host = d.FindString("sourceHost") ? *d.FindString("sourceHost") : "";
    if (auto* q = d.FindString("quality")) src->quality = *q;
    if (auto dur = d.FindDouble("duration")) src->duration = *dur;
    if (auto* t = d.FindString("thumbnail")) src->thumbnail = *t;

    if (src->url.empty()) continue;
    sources.push_back(std::move(src));
  }

  if (sources.empty()) return;

  VLOG(1) << "[BrowseHere] Reporting " << sources.size()
          << " video(s) from: " << page_url;
  host_remote_->OnVideosDetected(std::move(sources), page_title, page_url);
}

}  // namespace browse_here
