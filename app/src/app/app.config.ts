import { ApplicationConfig, inject, isDevMode, LOCALE_ID, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFrCh from '@angular/common/locales/fr-CH';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { routes } from './app.routes';
import { PairingDatastore } from './datastore/pairing.datastore';
import { ProfileDatastore } from './datastore/profile.datastore';
import { ReferenceDatastore } from './datastore/reference.datastore';
import { SettingsDatastore } from './datastore/settings.datastore';
import { TastingDatastore } from './datastore/tasting.datastore';
import { VerdictDatastore } from './datastore/verdict.datastore';
import { WineDatastore } from './datastore/wine.datastore';
import { BundledTranslateLoader } from './utils/bundled-translate-loader';

registerLocaleData(localeFrCh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({
      loader: provideTranslateLoader(BundledTranslateLoader),
      fallbackLang: 'fr',
      lang: 'fr',
    }),
    { provide: LOCALE_ID, useValue: 'fr-CH' },
    provideAppInitializer(() =>
      Promise.all([
        inject(WineDatastore).load(),
        inject(TastingDatastore).load(),
        inject(ProfileDatastore).load(),
        inject(PairingDatastore).load(),
        inject(VerdictDatastore).load(),
        inject(ReferenceDatastore).load(),
        inject(SettingsDatastore).load(),
      ]),
    ),
  ],
};
