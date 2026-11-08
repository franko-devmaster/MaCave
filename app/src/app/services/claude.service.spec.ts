import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { InvalidResponseError } from '../ai/claude-errors';
import { SettingsDatastore } from '../datastore/settings.datastore';
import { MaCaveDb } from '../db/schema';
import { apiError, connectionError, fakeSdk, textResponse } from '../testing/fake-claude';
import { createTestDb, provideTestDb } from '../testing/test-db';
import { CLAUDE_MODEL, CLAUDE_SDK_LOADER, ClaudeService, StructuredRequest } from './claude.service';

interface Echo {
  value: string;
}

const request: StructuredRequest<Echo> = {
  system: 'Système',
  content: [{ type: 'text', text: 'Bonjour' }],
  schema: { type: 'object' },
  effort: 'low',
  parse: (raw) => {
    if (typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>)['value'] === 'string') {
      return raw as Echo;
    }
    throw new InvalidResponseError('champ value manquant');
  },
};

describe('ClaudeService', () => {
  let db: MaCaveDb;

  function setup(handlers: Parameters<typeof fakeSdk>[0], online = true) {
    const fake = fakeSdk(handlers);
    db = createTestDb();
    TestBed.configureTestingModule({ providers: [provideTestDb(db), { provide: CLAUDE_SDK_LOADER, useValue: fake.loader }] });
    vi.spyOn(TestBed.inject(DOCUMENT).defaultView!.navigator, 'onLine', 'get').mockReturnValue(online);
    return { sut: TestBed.inject(ClaudeService), calls: fake.calls };
  }

  async function withKey(): Promise<void> {
    await TestBed.inject(SettingsDatastore).setApiKey('sk-ant-test-0123456789');
  }

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  it('structured when no key is set should not call the API', async () => {
    const { sut, calls } = setup({ respond: () => textResponse('{"value":"x"}') });

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'missing-key' });
    expect(calls).toHaveLength(0);
  });

  it('structured when offline should fail fast', async () => {
    const { sut, calls } = setup({ respond: () => textResponse('{"value":"x"}') }, false);
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'offline' });
    expect(calls).toHaveLength(0);
  });

  it('structured should send the model, schema, effort, fallback and browser options', async () => {
    const { sut, calls } = setup({ respond: () => textResponse('{"value":"ok"}') });
    await withKey();

    const result = await sut.structured(request);

    expect(result).toEqual({ ok: true, value: { value: 'ok' } });
    expect(calls[0].options).toMatchObject({ apiKey: 'sk-ant-test-0123456789', dangerouslyAllowBrowser: true });
    expect(calls[0].params).toMatchObject({
      model: CLAUDE_MODEL,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: 'Système',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Bonjour' }] }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: { type: 'object' } } },
    });
  });

  it.each([
    [401, 'invalid-key'],
    [403, 'forbidden'],
    [404, 'forbidden'],
    [429, 'rate-limit'],
    [500, 'unavailable'],
    [529, 'unavailable'],
    [408, 'unavailable'],
    [400, 'bad-request'],
    [418, 'unknown'],
  ])('structured when the API answers %s should report %s', async (status, kind) => {
    const { sut } = setup({
      respond: () => {
        throw apiError(status, 'Your credit balance is too low');
      },
    });
    await withKey();

    const result = await sut.structured(request);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.kind).toBe(kind);
  });

  it('structured when the API rejects the request should keep the API message', async () => {
    const { sut } = setup({
      respond: () => {
        throw apiError(400, 'Your credit balance is too low');
      },
    });
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'bad-request', detail: 'Your credit balance is too low' });
  });

  it('structured when the connection fails should report network', async () => {
    const { sut } = setup({
      respond: () => {
        throw connectionError();
      },
    });
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'network' });
  });

  it('structured when Claude refuses should report refusal', async () => {
    const { sut } = setup({ respond: () => textResponse('', 'refusal') });
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'refusal' });
  });

  it('structured when the answer is truncated should report invalid-response', async () => {
    const { sut } = setup({ respond: () => textResponse('{"val', 'max_tokens') });
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'invalid-response', detail: 'stop_reason max_tokens' });
  });

  it.each([
    ['pas du json', 'JSON illisible'],
    ['{"autre":1}', 'champ value manquant'],
  ])('structured when the answer is %s should report invalid-response', async (text, detail) => {
    const { sut } = setup({ respond: () => textResponse(text) });
    await withKey();

    expect(await sut.structured(request)).toEqual({ ok: false, kind: 'invalid-response', detail });
  });

  it('testKey should succeed when the model can be read', async () => {
    const { sut } = setup({ retrieve: () => ({ id: CLAUDE_MODEL }) });

    expect(await sut.testKey('sk-ant-x')).toEqual({ ok: true, value: true });
  });

  it('testKey when the key is rejected should report invalid-key', async () => {
    const { sut } = setup({
      retrieve: () => {
        throw apiError(401);
      },
    });

    expect(await sut.testKey('sk-ant-x')).toEqual({ ok: false, kind: 'invalid-key' });
  });
});
