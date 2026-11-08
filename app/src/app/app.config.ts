import { ApplicationConfig, isDevMode, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFrCh from '@angular/common/locales/fr-CH';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { routes } from './app.routes';
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
  ],
};
