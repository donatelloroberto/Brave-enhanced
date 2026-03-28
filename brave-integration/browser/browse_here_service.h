// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/browser/browse_here_service.h

#ifndef BRAVE_COMPONENTS_BROWSE_HERE_BROWSER_BROWSE_HERE_SERVICE_H_
#define BRAVE_COMPONENTS_BROWSE_HERE_BROWSER_BROWSE_HERE_SERVICE_H_

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "components/keyed_service/core/keyed_service.h"
#include "brave/components/browse_here/common/browse_here.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver_set.h"

class PrefService;

namespace browse_here {

// ---------------------------------------------------------------------------
// BrowseHereService — Browser-process KeyedService
//
// Responsibilities:
//   • Receives detected VideoSource objects from the renderer via Mojo IPC.
//   • Persists the playlist as a JSON file inside the user profile directory.
//   • Notifies the brave://browse-here WebUI page when new videos arrive.
//   • Lives as long as the browser profile session.
//
// Placement:
//   brave/components/browse_here/browser/browse_here_service.cc/.h
//   Add to: brave/browser/browse_here/browse_here_service_factory.cc
// ---------------------------------------------------------------------------

class BrowseHereService : public KeyedService,
                          public brave_browse_here::mojom::BrowseHereHost {
 public:
  explicit BrowseHereService(const base::FilePath& profile_path,
                             PrefService* pref_service);
  BrowseHereService(const BrowseHereService&) = delete;
  BrowseHereService& operator=(const BrowseHereService&) = delete;
  ~BrowseHereService() override;

  // ---------------------------------------------------------------------------
  // KeyedService
  // ---------------------------------------------------------------------------
  void Shutdown() override;

  // ---------------------------------------------------------------------------
  // BrowseHereHost (Mojo — called from the renderer scanner)
  // ---------------------------------------------------------------------------
  void OnVideosDetected(
      std::vector<brave_browse_here::mojom::VideoSourcePtr> videos,
      const std::string& page_title,
      const std::string& page_url) override;

  // ---------------------------------------------------------------------------
  // Playlist CRUD (called from BrowseHerePageHandler / WebUI)
  // ---------------------------------------------------------------------------
  using GetPlaylistCallback =
      base::OnceCallback<void(std::vector<brave_browse_here::mojom::PlaylistEntryPtr>)>;
  using AddToPlaylistCallback =
      base::OnceCallback<void(brave_browse_here::mojom::PlaylistEntryPtr)>;
  using RemoveFromPlaylistCallback = base::OnceCallback<void(bool)>;

  void GetPlaylist(GetPlaylistCallback callback);
  void AddToPlaylist(brave_browse_here::mojom::VideoSourcePtr video,
                     AddToPlaylistCallback callback);
  void RemoveFromPlaylist(int32_t id, RemoveFromPlaylistCallback callback);

  // Returns the most recently detected videos from the active tab.
  std::vector<brave_browse_here::mojom::VideoSourcePtr> GetDetectedVideos() const;
  const std::string& GetDetectedPageTitle() const;

  // Bind a renderer Mojo endpoint.
  void BindReceiver(
      mojo::PendingReceiver<brave_browse_here::mojom::BrowseHereHost> receiver);

  // Register/unregister the WebUI page so we can push events to it.
  void SetPageRemote(
      mojo::PendingRemote<brave_browse_here::mojom::BrowseHerePage> page);

 private:
  // Playlist persistence
  void LoadPlaylistFromDisk();
  void SavePlaylistToDisk();

  base::FilePath playlist_file_path_;
  PrefService* pref_service_;  // not owned

  // In-memory state
  std::vector<brave_browse_here::mojom::PlaylistEntryPtr> playlist_;
  std::vector<brave_browse_here::mojom::VideoSourcePtr> detected_videos_;
  std::string detected_page_title_;
  int32_t next_id_ = 1;

  // Mojo bindings
  mojo::ReceiverSet<brave_browse_here::mojom::BrowseHereHost> receivers_;
  mojo::Remote<brave_browse_here::mojom::BrowseHerePage> page_remote_;

  SEQUENCE_CHECKER(sequence_checker_);
  base::WeakPtrFactory<BrowseHereService> weak_factory_{this};
};

}  // namespace browse_here

#endif  // BRAVE_COMPONENTS_BROWSE_HERE_BROWSER_BROWSE_HERE_SERVICE_H_
