import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** État du réseau, suivi par les événements online / offline du navigateur. */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly onlineSignal = signal(this.window?.navigator.onLine ?? true);

  readonly online = this.onlineSignal.asReadonly();

  constructor() {
    const update = (): void => this.onlineSignal.set(this.window?.navigator.onLine ?? true);
    this.window?.addEventListener('online', update);
    this.window?.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('online', update);
      this.window?.removeEventListener('offline', update);
    });
  }
}
