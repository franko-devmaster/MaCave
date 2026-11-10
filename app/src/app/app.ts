import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { TabBarComponent } from './components/tab-bar/tab-bar';
import { AppUpdateService } from './services/app-update.service';
import { NetworkService } from './services/network.service';
import { ScrollService } from './services/scroll.service';
import { StoragePersistenceService } from './services/storage-persistence.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TabBarComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  template: `
    @if (update.updateReady()) {
      <div class="update" role="status">
        <span>{{ 'app.update.message' | translate }}</span>
        <button type="button" class="update__action" (click)="update.applyUpdate()">
          {{ 'app.update.action' | translate }}
        </button>
      </div>
    }
    @if (!network.online()) {
      <div class="offline" role="status">{{ 'app.offline' | translate }}</div>
    }
    <main class="content">
      <router-outlet />
    </main>
    @if (showTabBar()) {
      <app-tab-bar />
    }
  `,
})
export class App implements OnInit {
  protected readonly update = inject(AppUpdateService);
  protected readonly network = inject(NetworkService);
  private readonly storage = inject(StoragePersistenceService);
  private readonly scroll = inject(ScrollService);
  private readonly router = inject(Router);

  private readonly navigationEnd = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
  );

  protected readonly showTabBar = computed(() => {
    this.navigationEnd();
    return !deepestRoute(this.router.routerState.snapshot.root).data['hideTabBar'];
  });

  ngOnInit(): void {
    this.update.start();
    this.scroll.start();
    void this.storage.ensurePersisted();
  }
}

function deepestRoute(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
  let current = route;
  while (current.firstChild) {
    current = current.firstChild;
  }
  return current;
}
