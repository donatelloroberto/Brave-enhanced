// Copyright (c) 2024 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at https://mozilla.org/MPL/2.0/.

// DROP INTO: brave/browser/browse_here/browse_here_service_factory.h

#ifndef BRAVE_BROWSER_BROWSE_HERE_BROWSE_HERE_SERVICE_FACTORY_H_
#define BRAVE_BROWSER_BROWSE_HERE_BROWSE_HERE_SERVICE_FACTORY_H_

#include "base/no_destructor.h"
#include "components/keyed_service/content/browser_context_keyed_service_factory.h"

class Profile;

namespace browse_here {
class BrowseHereService;
}

// ---------------------------------------------------------------------------
// BrowseHereServiceFactory
//
// Creates and vends BrowseHereService instances, one per profile.
// Register in: brave/browser/brave_browser_main_extra_parts.cc
// ---------------------------------------------------------------------------

class BrowseHereServiceFactory
    : public BrowserContextKeyedServiceFactory {
 public:
  static browse_here::BrowseHereService* GetForProfile(Profile* profile);
  static BrowseHereServiceFactory* GetInstance();

  BrowseHereServiceFactory(const BrowseHereServiceFactory&) = delete;
  BrowseHereServiceFactory& operator=(const BrowseHereServiceFactory&) = delete;

 private:
  friend class base::NoDestructor<BrowseHereServiceFactory>;

  BrowseHereServiceFactory();
  ~BrowseHereServiceFactory() override;

  // BrowserContextKeyedServiceFactory
  KeyedService* BuildServiceInstanceFor(
      content::BrowserContext* context) const override;
  content::BrowserContext* GetBrowserContextToUse(
      content::BrowserContext* context) const override;
};

#endif  // BRAVE_BROWSER_BROWSE_HERE_BROWSE_HERE_SERVICE_FACTORY_H_
