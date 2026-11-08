import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService, PAGE_RELOAD } from './app-update.service';

class FakeSwUpdate {
  isEnabled = true;
  readonly versionUpdates = new Subject<VersionEvent>();
  readonly unrecoverable = new Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>();
  checkForUpdate = vi.fn().mockResolvedValue(false);
  activateUpdate = vi.fn().mockResolvedValue(true);
}

describe('AppUpdateService', () => {
  let sw: FakeSwUpdate;
  let sut: AppUpdateService;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sw = new FakeSwUpdate();
    reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: sw },
        { provide: PAGE_RELOAD, useValue: reload },
      ],
    });
    sut = TestBed.inject(AppUpdateService);
  });

  it('start when a new version is ready should flag the update', () => {
    sut.start();

    sw.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });

    expect(sut.updateReady()).toBe(true);
  });

  it('start when the app comes back to the foreground should check for an update', () => {
    sut.start();

    TestBed.inject(DOCUMENT).dispatchEvent(new Event('visibilitychange'));

    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('start when the service worker is in an unrecoverable state should reload', () => {
    sut.start();

    sw.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    expect(reload).toHaveBeenCalled();
  });

  it('check should report up-to-date when no update is found', async () => {
    expect(await sut.check()).toBe('up-to-date');
  });

  it('check should report available when an update is found', async () => {
    sw.checkForUpdate.mockResolvedValue(true);

    expect(await sut.check()).toBe('available');
  });

  it('check when the service worker is disabled should report unavailable', async () => {
    sw.isEnabled = false;

    expect(await sut.check()).toBe('unavailable');
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });

  it('applyUpdate should activate the new version then reload', async () => {
    await sut.applyUpdate();

    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });
});
