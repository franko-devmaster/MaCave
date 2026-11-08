import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import fr from '../../i18n/fr.json';

const TRANSLATIONS: Record<string, TranslationObject> = { fr };

/** Traductions embarquées dans le bundle : disponibles hors ligne, sans requête HTTP. */
@Injectable()
export class BundledTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(TRANSLATIONS[lang] ?? fr);
  }
}
