import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';

describe('NetworkService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('online should follow the browser events', () => {
    const window = TestBed.inject(DOCUMENT).defaultView as Window;
    const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    const sut = TestBed.inject(NetworkService);
    expect(sut.online()).toBe(true);

    onLine.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    expect(sut.online()).toBe(false);

    onLine.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    expect(sut.online()).toBe(true);
  });
});
