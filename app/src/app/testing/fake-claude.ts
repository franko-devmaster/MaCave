import * as realSdk from '@anthropic-ai/sdk';

export interface FakeCall {
  options: Record<string, unknown>;
  params: Record<string, unknown>;
}

/**
 * SDK factice : vraies classes d'erreurs, client simulé. `respond` fournit la réponse
 * de messages.create ou lève une erreur ; `retrieve` celle de models.retrieve.
 */
export function fakeSdk(handlers: {
  respond?: (params: Record<string, unknown>) => unknown;
  retrieve?: () => unknown;
}): { loader: () => Promise<typeof realSdk>; calls: FakeCall[] } {
  const calls: FakeCall[] = [];
  class FakeAnthropic {
    readonly beta = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push({ options: this.options, params });
          return handlers.respond?.(params);
        },
      },
    };
    readonly models = {
      retrieve: async () => handlers.retrieve?.(),
    };
    constructor(private readonly options: Record<string, unknown>) {}
  }
  const sdk = { ...realSdk, default: FakeAnthropic } as unknown as typeof realSdk;
  return { loader: async () => sdk, calls };
}

export function textResponse(text: string, stopReason = 'end_turn'): unknown {
  return { stop_reason: stopReason, content: [{ type: 'text', text }] };
}

export function apiError(status: number, message = 'erreur'): Error {
  return realSdk.APIError.generate(status, { type: 'error', error: { type: 'api_error', message } }, message, new Headers());
}

export function connectionError(): Error {
  return new realSdk.APIConnectionError({ message: 'fetch failed' });
}
