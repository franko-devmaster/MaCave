import { TestBed } from '@angular/core/testing';
import { MaCaveDb } from '../db/schema';
import { CLAUDE_SDK_LOADER } from '../services/claude.service';
import { PhotoError, PhotoService } from '../services/photo.service';
import { apiError, fakeSdk, textResponse } from '../testing/fake-claude';
import { wineInput } from '../testing/fixtures';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { AddWineDatastore } from './add-wine.datastore';
import { SettingsDatastore } from './settings.datastore';
import { WineDatastore } from './wine.datastore';

const READING = {
  notReadable: false, name: 'Cornalin', producer: 'Germanier', vintage: 2019, color: 'rouge', country: 'Suisse',
  region: 'Valais', appellation: null, grapes: ['Cornalin'], alcohol: null, sweetness: null, drinkFrom: 2024,
  drinkUntil: 2030, quantity: null, pricePaid: null, uncertainFields: ['drinkFrom', 'drinkUntil'], possibleDuplicateId: null,
};

describe('AddWineDatastore', () => {
  let db: MaCaveDb;
  let respond: (params: Record<string, unknown>) => unknown;
  let calls: ReturnType<typeof fakeSdk>['calls'];
  let prepare: ReturnType<typeof vi.fn>;
  let sut: AddWineDatastore;

  beforeEach(async () => {
    respond = () => textResponse(JSON.stringify(READING));
    const fake = fakeSdk({ respond: (params) => respond(params) });
    calls = fake.calls;
    prepare = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]).buffer, mediaType: 'image/jpeg', width: 10, height: 20, base64: 'AQ==' });
    db = createTestDb();
    TestBed.configureTestingModule({
      providers: [
        provideTestDb(db),
        { provide: CLAUDE_SDK_LOADER, useValue: fake.loader },
        { provide: PhotoService, useValue: { prepare } },
      ],
    });
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
    URL.createObjectURL = vi.fn().mockReturnValue('blob:preview');
    URL.revokeObjectURL = vi.fn();
    sut = TestBed.inject(AddWineDatastore);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('readPhoto should send the resized photo with the inventory and expose the reading', async () => {
    const existing = await TestBed.inject(WineDatastore).create(wineInput({ name: 'Humagne' }), { quantity: 1, pricePaid: null });

    await sut.readPhoto(new File(['x'], 'etiquette.heic'));

    expect(sut.status()).toBe('done');
    expect(sut.reading()?.name).toBe('Cornalin');
    expect(sut.preview()).toBe('blob:preview');
    expect(sut.photoToSave()).toEqual({ bytes: expect.any(ArrayBuffer), mediaType: 'image/jpeg', width: 10, height: 20 });
    const content = (calls[0].params['messages'] as { content: { type: string; text?: string }[] }[])[0].content;
    expect(content[0].text).toContain(`id=${existing.id}`);
    expect(content[1]).toMatchObject({ type: 'image', source: { data: 'AQ==' } });
  });

  it('readPhoto when the image cannot be decoded should report not-readable without calling Claude', async () => {
    prepare.mockRejectedValue(new PhotoError('image illisible'));

    await sut.readPhoto(new File(['x'], 'cassee.jpg'));

    expect(sut.status()).toBe('error');
    expect(sut.error()).toEqual({ ok: false, kind: 'not-readable', detail: 'image illisible' });
    expect(calls).toHaveLength(0);
  });

  it('readPhoto when Claude finds no label should report not-readable', async () => {
    respond = () => textResponse(JSON.stringify({ ...READING, notReadable: true, name: '' }));

    await sut.readPhoto(new File(['x'], 'chat.jpg'));

    expect(sut.error()?.kind).toBe('not-readable');
  });

  it('readDescription should send the text and surface API errors', async () => {
    respond = () => {
      throw apiError(429);
    };

    await sut.readDescription('Cornalin Germanier 2019');

    expect(sut.status()).toBe('error');
    expect(sut.error()?.kind).toBe('rate-limit');
    const content = (calls[0].params['messages'] as { content: { text?: string }[] }[])[0].content;
    expect(content[1].text).toBe('Description du vin : « Cornalin Germanier 2019 »');
  });

  it('readDescription with blank text should do nothing', async () => {
    await sut.readDescription('   ');

    expect(sut.status()).toBe('idle');
    expect(calls).toHaveLength(0);
  });

  it('reset should clear the reading and release the preview', async () => {
    await sut.readPhoto(new File(['x'], 'etiquette.jpg'));

    sut.reset();

    expect(sut.status()).toBe('idle');
    expect(sut.reading()).toBeNull();
    expect(sut.photoToSave()).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
