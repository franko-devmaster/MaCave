import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FileShareService } from './file-share.service';

describe('FileShareService', () => {
  const file = new File(['{}'], 'ma-cave-2026-11-08.json', { type: 'application/json' });
  let nav: Record<string, unknown>;
  let sut: FileShareService;

  beforeEach(() => {
    nav = {};
    const document = TestBed.inject(DOCUMENT);
    vi.spyOn(document.defaultView as Window, 'navigator', 'get').mockReturnValue(nav as unknown as Navigator);
    sut = TestBed.inject(FileShareService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deliver when the share sheet supports files should share', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    nav['canShare'] = vi.fn().mockReturnValue(true);
    nav['share'] = share;

    expect(await sut.deliver(file)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: file.name });
  });

  it('deliver when the user closes the share sheet should report cancelled', async () => {
    nav['canShare'] = vi.fn().mockReturnValue(true);
    nav['share'] = vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError'));

    expect(await sut.deliver(file)).toBe('cancelled');
  });

  it('deliver when sharing is unavailable should download the file', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    URL.revokeObjectURL = vi.fn();

    expect(await sut.deliver(file)).toBe('downloaded');
    expect(click).toHaveBeenCalled();
  });
});
