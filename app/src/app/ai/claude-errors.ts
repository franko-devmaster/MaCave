import type * as AnthropicSdk from '@anthropic-ai/sdk';

export type ClaudeErrorKind =
  | 'missing-key'
  | 'offline'
  | 'invalid-key'
  | 'forbidden'
  | 'rate-limit'
  | 'unavailable'
  | 'bad-request'
  | 'network'
  | 'refusal'
  | 'not-readable'
  | 'invalid-response'
  | 'unknown';

export interface ClaudeFailure {
  ok: false;
  kind: ClaudeErrorKind;
  detail?: string;
}

export interface ClaudeSuccess<T> {
  ok: true;
  value: T;
}

export type ClaudeResult<T> = ClaudeSuccess<T> | ClaudeFailure;

export function failure(kind: ClaudeErrorKind, detail?: string): ClaudeFailure {
  return detail ? { ok: false, kind, detail } : { ok: false, kind };
}

/** Réponse de Claude lisible mais non conforme au schéma attendu. */
export class InvalidResponseError extends Error {}

/** Classe une erreur du SDK d'après ses classes typées, du plus précis au plus général. */
export function classifyError(error: unknown, sdk: typeof AnthropicSdk): ClaudeFailure {
  if (error instanceof sdk.AuthenticationError) {
    return failure('invalid-key');
  }
  if (error instanceof sdk.PermissionDeniedError || error instanceof sdk.NotFoundError) {
    return failure('forbidden', apiMessage(error));
  }
  if (error instanceof sdk.RateLimitError) {
    return failure('rate-limit');
  }
  if (error instanceof sdk.InternalServerError || error instanceof sdk.RequestTimeoutError) {
    return failure('unavailable');
  }
  if (error instanceof sdk.BadRequestError) {
    return failure('bad-request', apiMessage(error));
  }
  if (error instanceof sdk.APIConnectionError) {
    return failure('network');
  }
  if (error instanceof sdk.APIError) {
    return failure('unknown', `HTTP ${error.status ?? '?'}`);
  }
  if (error instanceof InvalidResponseError) {
    return failure('invalid-response', error.message);
  }
  return failure('unknown', error instanceof Error ? error.message : String(error));
}

/** Message renvoyé par l'API dans le corps d'erreur, sans le préfixe de statut ajouté par le SDK. */
function apiMessage(error: AnthropicSdk.APIError): string | undefined {
  const body: unknown = error.error;
  if (isRecord(body) && isRecord(body['error']) && typeof body['error']['message'] === 'string') {
    return body['error']['message'];
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
