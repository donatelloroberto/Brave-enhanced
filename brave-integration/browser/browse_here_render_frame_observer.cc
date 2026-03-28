// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/renderer/browse_here_render_frame_observer.cc

#include "brave/components/browse_here/renderer/browse_here_render_frame_observer.h"

#include "base/logging.h"
#include "content/public/renderer/render_frame.h"
#include "third_party/blink/public/web/web_local_frame.h"
#include "third_party/blink/public/web/web_script_source.h"
#include "grit/brave_browse_here_renderer_resources.h"

namespace browse_here {

BrowseHereRenderFrameObserver::BrowseHereRenderFrameObserver(
    content::RenderFrame* render_frame)
    : RenderFrameObserver(render_frame) {
  // Bind the Mojo remote to the browser-process BrowseHereHost.
  render_frame->GetBrowserInterfaceBroker()->GetInterface(
      host_remote_.BindNewPipeAndPassReceiver());
}

BrowseHereRenderFrameObserver::~BrowseHereRenderFrameObserver() = default;

void BrowseHereRenderFrameObserver::DidCreateNewDocument() {
  // Only inject into the main frame of regular web pages.
  // Avoid injecting into brave:// pages, chrome:// pages, etc.
  if (!render_frame()->IsMainFrame()) return;
  const GURL& url = render_frame()->GetWebFrame()->GetDocument().Url();
  if (!url.SchemeIsHTTPOrHTTPS()) return;

  InjectScanner();
}

void BrowseHereRenderFrameObserver::DidFinishLoad() {
  // Re-trigger scan after full page load to catch late-rendered video elements.
  if (!render_frame()->IsMainFrame()) return;
  const GURL& url = render_frame()->GetWebFrame()->GetDocument().Url();
  if (!url.SchemeIsHTTPOrHTTPS()) return;
  render_frame()->GetWebFrame()->ExecuteScript(
      blink::WebScriptSource(
          "window.__browseHereRescan && window.__browseHereRescan();"));
}

void BrowseHereRenderFrameObserver::OnDestruct() {
  delete this;
}

void BrowseHereRenderFrameObserver::InjectScanner() {
  // The scanner JS is compiled from browse_here_scanner.ts and bundled
  // as a grit resource IDR_BROWSE_HERE_SCANNER_JS.
  base::StringPiece scanner_js =
      ui::ResourceBundle::GetSharedInstance().GetRawDataResource(
          IDR_BROWSE_HERE_SCANNER_JS);

  render_frame()->GetWebFrame()->ExecuteScript(
      blink::WebScriptSource(blink::WebString::FromUTF8(scanner_js)));
}

}  // namespace browse_here
