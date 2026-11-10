import { TestBed } from '@angular/core/testing';
import { fitWithin, INFO_MAX_SIDE, PDF_MAX_BYTES, PhotoError, PhotoService } from './photo.service';

describe('fitWithin', () => {
  it.each([
    [4032, 3024, { width: 1280, height: 960 }],
    [3024, 4032, { width: 960, height: 1280 }],
    [800, 600, { width: 800, height: 600 }],
    [1280, 1280, { width: 1280, height: 1280 }],
  ])('fitWithin(%s, %s) should give %o', (width, height, expected) => {
    expect(fitWithin(width, height, 1280)).toEqual(expected);
  });
});

describe('PhotoService.prepareInfo', () => {
  function pdf(size: number, name = 'qoqa.pdf', type = 'application/pdf'): File {
    const bytes = new Uint8Array(size);
    return { name, type, size, arrayBuffer: async () => bytes.buffer } as unknown as File;
  }

  it('prepareInfo should keep a PDF as is', async () => {
    const sut = TestBed.inject(PhotoService);

    const info = await sut.prepareInfo(pdf(1234));

    expect(info).toMatchObject({ mediaType: 'application/pdf', width: 0, height: 0 });
    expect(info.bytes.byteLength).toBe(1234);
  });

  it('prepareInfo should recognise a PDF by its extension when the type is missing', async () => {
    const info = await TestBed.inject(PhotoService).prepareInfo(pdf(10, 'Fiche.PDF', ''));

    expect(info.mediaType).toBe('application/pdf');
  });

  it('prepareInfo should refuse a PDF over 10 MB', async () => {
    await expect(TestBed.inject(PhotoService).prepareInfo(pdf(PDF_MAX_BYTES + 1))).rejects.toThrow(new PhotoError('PDF trop volumineux'));
  });

  it('prepareInfo for an image should resize it to 2048 px', async () => {
    const sut = TestBed.inject(PhotoService);
    const prepare = vi.spyOn(sut, 'prepare').mockResolvedValue({ bytes: new ArrayBuffer(1), mediaType: 'image/jpeg', width: 2048, height: 1536, base64: 'AA==' });

    const info = await sut.prepareInfo({ name: 'fiche.jpg', type: 'image/jpeg', size: 1 } as File);

    expect(prepare).toHaveBeenCalledWith(expect.anything(), INFO_MAX_SIDE);
    expect(info).toEqual({ bytes: expect.any(ArrayBuffer), mediaType: 'image/jpeg', width: 2048, height: 1536 });
  });
});
