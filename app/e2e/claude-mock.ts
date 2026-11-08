import { Page, Request } from '@playwright/test';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-expose-headers': '*',
};

export interface ClaudeMock {
  /** Corps JSON des requêtes envoyées à /v1/messages. */
  messageBodies: Record<string, unknown>[];
}

type Reply = { status: number; body: unknown };

/** Simule l'API Claude : aucune requête ne part vers Anthropic pendant les tests. */
export async function mockClaude(
  page: Page,
  handlers: { messages?: (body: Record<string, unknown>) => Reply; models?: () => Reply },
): Promise<ClaudeMock> {
  const mock: ClaudeMock = { messageBodies: [] };
  await page.route('https://api.anthropic.com/**', async (route, request: Request) => {
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const url = new URL(request.url());
    let reply: Reply = { status: 404, body: { type: 'error', error: { type: 'not_found_error', message: 'non simulé' } } };
    if (url.pathname.startsWith('/v1/messages') && handlers.messages) {
      const body = request.postDataJSON() as Record<string, unknown>;
      mock.messageBodies.push(body);
      reply = handlers.messages(body);
    } else if (url.pathname.startsWith('/v1/models') && handlers.models) {
      reply = handlers.models();
    }
    await route.fulfill({
      status: reply.status,
      headers: { ...CORS, 'content-type': 'application/json', 'x-should-retry': 'false', 'request-id': 'req_test' },
      body: JSON.stringify(reply.body),
    });
  });
  return mock;
}

export function message(json: unknown, stopReason = 'end_turn'): Reply {
  return {
    status: 200,
    body: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text: JSON.stringify(json) }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    },
  };
}

export function apiError(status: number, type: string, text: string): Reply {
  return { status, body: { type: 'error', error: { type, message: text } } };
}

export const MODEL_OK: Reply = { status: 200, body: { id: 'claude-opus-5-5', type: 'model', display_name: 'Claude Opus 5.5' } };

export function reading(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    notReadable: false,
    name: 'Cornalin',
    producer: 'Germanier',
    vintage: 2019,
    color: 'rouge',
    country: 'Suisse',
    region: 'Valais',
    appellation: 'AOC Valais',
    grapes: ['Cornalin'],
    alcohol: 13.5,
    sweetness: null,
    drinkFrom: 2024,
    drinkUntil: 2030,
    quantity: null,
    pricePaid: null,
    uncertainFields: ['drinkFrom', 'drinkUntil'],
    possibleDuplicateId: null,
    ...overrides,
  };
}

/** PNG 8×6 bordeaux, décodable par createImageBitmap. */
export const LABEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGOoktfDihgGUgIA/dwlUXlpw4YAAAAASUVORK5CYII=',
  'base64',
);
