// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/browse_here/browse_here_service_factory.cc

#include "brave/browser/browse_here/browse_here_service_factory.h"

#include "brave/components/browse_here/browser/browse_here_service.h"
#include "chrome/browser/profiles/profile.h"
#include "components/keyed_service/content/browser_context_dependency_manager.h"
#include "components/prefs/pref_service.h"

// static
browse_here::BrowseHereService* BrowseHereServiceFactory::GetForProfile(
    Profile* profile) {
  return static_cast<browse_here::BrowseHereService*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

// static
BrowseHereServiceFactory* BrowseHereServiceFactory::GetInstance() {
  static base::NoDestructor<BrowseHereServiceFactory> instance;
  return instance.get();
}

BrowseHereServiceFactory::BrowseHereServiceFactory()
    : BrowserContextKeyedServiceFactory(
          "BrowseHereService",
          BrowserContextDependencyManager::GetInstance()) {}

BrowseHereServiceFactory::~BrowseHereServiceFactory() = default;

KeyedService* BrowseHereServiceFactory::BuildServiceInstanceFor(
    content::BrowserContext* context) const {
  auto* profile = Profile::FromBrowserContext(context);
  return new browse_here::BrowseHereService(profile->GetPath(),
                                             profile->GetPrefs());
}

content::BrowserContext* BrowseHereServiceFactory::GetBrowserContextToUse(
    content::BrowserContext* context) const {
  // Use the original profile (not incognito)
  return chrome::GetBrowserContextRedirectedInIncognito(context);
}
