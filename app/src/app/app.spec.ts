import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';
import { App } from './app';
import { routes } from './app.routes';
import { createTestDb, provideTestDb } from './testing/test-db';
import { BundledTranslateLoader } from './utils/bundled-translate-loader';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideTranslateService({ loader: provideTranslateLoader(BundledTranslateLoader), lang: 'fr', fallbackLang: 'fr' }),
        { provide: SwUpdate, useValue: { isEnabled: false } },
        provideTestDb(createTestDb()),
      ],
    }).compileComponents();
  });

  async function render(url: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('root url should redirect to the cave with the tab bar', async () => {
    const element = await render('/');

    expect(TestBed.inject(Router).url).toBe('/cave');
    expect(element.querySelector('h1')?.textContent).toContain('Ma cave');
    expect(element.querySelector('app-tab-bar')).not.toBeNull();
  });

  it('settings page should hide the tab bar', async () => {
    const element = await render('/reglages');

    expect(element.querySelector('h1')?.textContent).toContain('Réglages');
    expect(element.querySelector('app-tab-bar')).toBeNull();
  });

  it('unknown url should fall back to the cave', async () => {
    await render('/nulle-part');

    expect(TestBed.inject(Router).url).toBe('/cave');
  });
});
