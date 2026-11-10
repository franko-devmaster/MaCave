import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, EnvironmentInjector, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Défilement de l'application. Le conteneur qui défile est `main`, pas la fenêtre : le routeur ne
 * gère donc pas la position. À l'aller, un écran s'ouvre en haut ; au retour, la position est rendue.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly positions = new Map<string, number>();
  private restoring = false;
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.positions.set(this.router.url, this.container()?.scrollTop ?? 0);
        this.restoring = event.navigationTrigger === 'popstate';
      } else if (event instanceof NavigationEnd) {
        const top = this.restoring ? (this.positions.get(event.urlAfterRedirects) ?? 0) : 0;
        this.afterRender(() => this.scrollTo(top));
      }
    });
  }

  /**
   * Remonte en haut une fois l'écran rendu, clavier fermé. Sans animation : sur iOS, une animation
   * est interrompue quand la hauteur du contenu change (formulaire vidé, détails repliés).
   */
  toTop(): void {
    const active = this.document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    this.afterRender(() => this.scrollTo(0));
  }

  private afterRender(action: () => void): void {
    afterNextRender(() => requestAnimationFrame(action), { injector: this.injector });
  }

  private scrollTo(top: number): void {
    const container = this.container();
    if (container) {
      container.scrollTop = top;
    }
    if (top === 0) {
      const page = this.document.scrollingElement;
      if (page) {
        page.scrollTop = 0;
      }
    }
  }

  private container(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>('main.content');
  }
}
