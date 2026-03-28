// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/components/browse_here/browser/browse_here_service.cc

#include "brave/components/browse_here/browser/browse_here_service.h"

#include <algorithm>
#include <utility>

#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/logging.h"
#include "base/strings/string_number_conversions.h"
#include "base/task/thread_pool.h"
#include "base/time/time.h"
#include "base/values.h"
#include "base/files/file_util.h"

namespace browse_here {

namespace {

constexpr base::FilePath::CharType kPlaylistFileName[] =
    FILE_PATH_LITERAL("BrowseHerePlaylist.json");

// Serialize a PlaylistEntry to a base::Value::Dict for JSON persistence.
base::Value::Dict EntryToDict(
    const brave_browse_here::mojom::PlaylistEntry& e) {
  base::Value::Dict d;
  d.Set("id", e.id);
  d.Set("url", e.url);
  d.Set("type", e.type);
  d.Set("title", e.title);
  if (e.quality) d.Set("quality", *e.quality);
  if (e.duration) d.Set("duration", *e.duration);
  if (e.thumbnail) d.Set("thumbnail", *e.thumbnail);
  d.Set("source_host", e.source_host);
  d.Set("added_at", e.added_at);
  return d;
}

// Deserialize a PlaylistEntry from a stored base::Value::Dict.
brave_browse_here::mojom::PlaylistEntryPtr DictToEntry(
    const base::Value::Dict& d) {
  auto entry = brave_browse_here::mojom::PlaylistEntry::New();
  entry->id          = d.FindInt("id").value_or(0);
  entry->url         = d.FindString("url") ? *d.FindString("url") : "";
  entry->type        = d.FindString("type") ? *d.FindString("type") : "unknown";
  entry->title       = d.FindString("title") ? *d.FindString("title") : "";
  entry->source_host = d.FindString("source_host") ? *d.FindString("source_host") : "";
  entry->added_at    = d.FindString("added_at") ? *d.FindString("added_at") : "";
  if (auto* q = d.FindString("quality")) entry->quality = *q;
  if (auto dur = d.FindDouble("duration")) entry->duration = *dur;
  if (auto* t = d.FindString("thumbnail")) entry->thumbnail = *t;
  return entry;
}

}  // namespace

// ---------------------------------------------------------------------------
// Construction / Destruction
// ---------------------------------------------------------------------------

BrowseHereService::BrowseHereService(const base::FilePath& profile_path,
                                     PrefService* pref_service)
    : playlist_file_path_(profile_path.Append(kPlaylistFileName)),
      pref_service_(pref_service) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  LoadPlaylistFromDisk();
}

BrowseHereService::~BrowseHereService() = default;

// ---------------------------------------------------------------------------
// KeyedService
// ---------------------------------------------------------------------------

void BrowseHereService::Shutdown() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  receivers_.Clear();
  page_remote_.reset();
}

// ---------------------------------------------------------------------------
// BrowseHereHost (Mojo — renderer → browser)
// ---------------------------------------------------------------------------

void BrowseHereService::OnVideosDetected(
    std::vector<brave_browse_here::mojom::VideoSourcePtr> videos,
    const std::string& page_title,
    const std::string& page_url) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  VLOG(1) << "[BrowseHere] Detected " << videos.size()
          << " video(s) on: " << page_url;

  detected_videos_ = std::move(videos);
  detected_page_title_ = page_title;

  // Push event to the WebUI page if it is currently open.
  if (page_remote_.is_bound()) {
    // Clone the detected_videos_ to send via Mojo.
    std::vector<brave_browse_here::mojom::VideoSourcePtr> clones;
    clones.reserve(detected_videos_.size());
    for (const auto& v : detected_videos_) {
      clones.push_back(v->Clone());
    }
    page_remote_->OnVideosDetected(std::move(clones), detected_page_title_,
                                   page_url);
  }
}

// ---------------------------------------------------------------------------
// Playlist CRUD
// ---------------------------------------------------------------------------

void BrowseHereService::GetPlaylist(GetPlaylistCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  std::vector<brave_browse_here::mojom::PlaylistEntryPtr> result;
  result.reserve(playlist_.size());
  for (const auto& e : playlist_) {
    result.push_back(e->Clone());
  }
  std::move(callback).Run(std::move(result));
}

void BrowseHereService::AddToPlaylist(
    brave_browse_here::mojom::VideoSourcePtr video,
    AddToPlaylistCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);

  auto entry = brave_browse_here::mojom::PlaylistEntry::New();
  entry->id          = next_id_++;
  entry->url         = video->url;
  entry->type        = video->type;
  entry->title       = video->title;
  entry->quality     = video->quality;
  entry->duration    = video->duration;
  entry->thumbnail   = video->thumbnail;
  entry->source_host = video->source_host;

  // ISO 8601 timestamp
  base::Time::Exploded ex;
  base::Time::Now().UTCExplode(&ex);
  entry->added_at = base::StringPrintf(
      "%04d-%02d-%02dT%02d:%02d:%02dZ",
      ex.year, ex.month, ex.day_of_month,
      ex.hour, ex.minute, ex.second);

  auto clone = entry->Clone();
  playlist_.push_back(std::move(entry));
  SavePlaylistToDisk();

  std::move(callback).Run(std::move(clone));
}

void BrowseHereService::RemoveFromPlaylist(int32_t id,
                                           RemoveFromPlaylistCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  auto it = std::find_if(playlist_.begin(), playlist_.end(),
                         [id](const auto& e) { return e->id == id; });
  if (it == playlist_.end()) {
    std::move(callback).Run(false);
    return;
  }
  playlist_.erase(it);
  SavePlaylistToDisk();
  std::move(callback).Run(true);
}

std::vector<brave_browse_here::mojom::VideoSourcePtr>
BrowseHereService::GetDetectedVideos() const {
  std::vector<brave_browse_here::mojom::VideoSourcePtr> clones;
  clones.reserve(detected_videos_.size());
  for (const auto& v : detected_videos_) {
    clones.push_back(v->Clone());
  }
  return clones;
}

const std::string& BrowseHereService::GetDetectedPageTitle() const {
  return detected_page_title_;
}

// ---------------------------------------------------------------------------
// Mojo binding helpers
// ---------------------------------------------------------------------------

void BrowseHereService::BindReceiver(
    mojo::PendingReceiver<brave_browse_here::mojom::BrowseHereHost> receiver) {
  receivers_.Add(this, std::move(receiver));
}

void BrowseHereService::SetPageRemote(
    mojo::PendingRemote<brave_browse_here::mojom::BrowseHerePage> page) {
  page_remote_.reset();
  page_remote_.Bind(std::move(page));
}

// ---------------------------------------------------------------------------
// Disk persistence
// ---------------------------------------------------------------------------

void BrowseHereService::LoadPlaylistFromDisk() {
  if (!base::PathExists(playlist_file_path_)) return;

  std::string json;
  if (!base::ReadFileToString(playlist_file_path_, &json)) {
    LOG(ERROR) << "[BrowseHere] Failed to read playlist file";
    return;
  }

  auto result = base::JSONReader::ReadAndReturnValueWithError(json);
  if (!result.has_value() || !result->is_list()) {
    LOG(ERROR) << "[BrowseHere] Invalid playlist JSON: "
               << result.error().message;
    return;
  }

  int32_t max_id = 0;
  for (const auto& item : result->GetList()) {
    if (!item.is_dict()) continue;
    auto entry = DictToEntry(item.GetDict());
    if (entry->id > max_id) max_id = entry->id;
    playlist_.push_back(std::move(entry));
  }
  next_id_ = max_id + 1;
  VLOG(1) << "[BrowseHere] Loaded " << playlist_.size()
          << " playlist entries from disk";
}

void BrowseHereService::SavePlaylistToDisk() {
  base::Value::List list;
  for (const auto& e : playlist_) {
    list.Append(EntryToDict(*e));
  }
  std::string json;
  base::JSONWriter::WriteWithOptions(
      base::Value(std::move(list)),
      base::JSONWriter::OPTIONS_PRETTY_PRINT,
      &json);

  base::ThreadPool::PostTask(
      FROM_HERE,
      {base::MayBlock(), base::TaskPriority::BEST_EFFORT},
      base::BindOnce(
          [](base::FilePath path, std::string data) {
            if (!base::WriteFile(path, data)) {
              LOG(ERROR) << "[BrowseHere] Failed to save playlist";
            }
          },
          playlist_file_path_, std::move(json)));
}

}  // namespace browse_here
