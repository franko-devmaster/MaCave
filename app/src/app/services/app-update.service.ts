import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

export type UpdateCheck = 'available' | 'up-to-date' | 'unavailable';

export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.location.reload();
  },
});

/**
 * Détecte les nouvelles versions publiées. Sur iOS, une PWA reprise depuis l'arrière-plan
 * ne recharge pas la page : on vérifie donc aussi à chaque retour au premier plan.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reloadPage = inject(PAGE_RELOAD);
  private readonly updateReadySignal = signal(false);
  private started = false;

  readonly updateReady = this.updateReadySignal.asReadonly();
  readonly enabled = this.swUpdate.isEnabled;

  start(): void {
    if (this.started || !this.swUpdate.isEnabled) {
      return;
    }
    this.started = true;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.updateReadySignal.set(true));

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    const onVisible = (): void => {
      if (this.document.visibilityState === 'visible') {
        void this.check();
      }
    };
    this.document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => this.document.removeEventListener('visibilitychange', onVisible));
  }

  async check(): Promise<UpdateCheck> {
    if (!this.swUpdate.isEnabled) {
      return 'unavailable';
    }
    try {
      const found = await this.swUpdate.checkForUpdate();
      return found ? 'available' : 'up-to-date';
    } catch {
      return 'unavailable';
    }
  }

  async applyUpdate(): Promise<void> {
    await this.swUpdate.activateUpdate();
    this.reload();
  }

  private reload(): void {
    this.reloadPage();
  }
}
