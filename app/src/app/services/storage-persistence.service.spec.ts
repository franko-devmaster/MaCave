import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { StoragePersistenceService } from './storage-persistence.service';

function setup(storage: Partial<StorageManager> | undefined): StoragePersistenceService {
  const fakeDocument = { defaultView: { navigator: { storage } } } as unknown as Document;
  TestBed.configureTestingModule({ providers: [{ provide: DOCUMENT, useValue: fakeDocument }] });
  return TestBed.inject(StoragePersistenceService);
}

describe('StoragePersistenceService', () => {
  it('ensurePersisted when already persisted should not ask again', async () => {
    const persist = vi.fn();
    const sut = setup({ persisted: vi.fn().mockResolvedValue(true), persist });

    expect(await sut.ensurePersisted()).toBe('persisted');
    expect(persist).not.toHaveBeenCalled();
    expect(sut.status()).toBe('persisted');
  });

  it('ensurePersisted when browser grants persistence should report persisted', async () => {
    const sut = setup({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) });

    expect(await sut.ensurePersisted()).toBe('persisted');
  });

  it('ensurePersisted when browser refuses should report not-persisted', async () => {
    const sut = setup({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });

    expect(await sut.ensurePersisted()).toBe('not-persisted');
    expect(sut.status()).toBe('not-persisted');
  });

  it('ensurePersisted when the API is missing should report unsupported', async () => {
    const sut = setup(undefined);

    expect(await sut.ensurePersisted()).toBe('unsupported');
  });
});
