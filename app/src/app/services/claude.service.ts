import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import type * as AnthropicSdk from '@anthropic-ai/sdk';
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { classifyError, ClaudeResult, failure, InvalidResponseError } from '../ai/claude-errors';
import { SettingsDatastore } from '../datastore/settings.datastore';

export const CLAUDE_MODEL = 'claude-opus-5-5';

type Sdk = typeof AnthropicSdk;

/** Charge le SDK à la demande : il ne pèse pas sur le démarrage de l'application. */
export const CLAUDE_SDK_LOADER = new InjectionToken<() => Promise<Sdk>>('CLAUDE_SDK_LOADER', {
  providedIn: 'root',
  factory: () => () => import('@anthropic-ai/sdk'),
});

export interface StructuredRequest<T> {
  system: string;
  content: BetaContentBlockParam[];
  schema: Record<string, unknown>;
  effort: 'low' | 'medium' | 'high';
  /** Valide la réponse JSON ; lève InvalidResponseError si elle n'est pas conforme. */
  parse: (raw: unknown) => T;
}

/** Seul point d'accès à l'API Claude. La clé est lue dans les réglages de l'appareil. */
@Injectable({ providedIn: 'root' })
export class ClaudeService {
  private readonly settings = inject(SettingsDatastore);
  private readonly loadSdk = inject(CLAUDE_SDK_LOADER);
  private readonly document = inject(DOCUMENT);

  /** Vérifie une clé sans générer de texte : lecture de la fiche du modèle, non facturée. */
  async testKey(apiKey: string): Promise<ClaudeResult<true>> {
    if (this.isOffline()) {
      return failure('offline');
    }
    const sdk = await this.loadSdk();
    try {
      await this.client(sdk, apiKey).models.retrieve(CLAUDE_MODEL);
      return { ok: true, value: true };
    } catch (error) {
      return classifyError(error, sdk);
    }
  }

  async structured<T>(request: StructuredRequest<T>): Promise<ClaudeResult<T>> {
    const apiKey = this.settings.apiKey();
    if (!apiKey) {
      return failure('missing-key');
    }
    if (this.isOffline()) {
      return failure('offline');
    }
    const sdk = await this.loadSdk();
    try {
      const response = await this.client(sdk, apiKey).beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: request.system,
        messages: [{ role: 'user', content: request.content }],
        output_config: { effort: request.effort, format: { type: 'json_schema', schema: request.schema } },
      });
      if (response.stop_reason === 'refusal') {
        return failure('refusal');
      }
      if (response.stop_reason !== 'end_turn') {
        return failure('invalid-response', `stop_reason ${response.stop_reason}`);
      }
      const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
      return { ok: true, value: request.parse(parseJson(text)) };
    } catch (error) {
      return classifyError(error, sdk);
    }
  }

  private client(sdk: Sdk, apiKey: string): AnthropicSdk.Anthropic {
    return new sdk.default({ apiKey, dangerouslyAllowBrowser: true, timeout: 60_000, maxRetries: 1 });
  }

  private isOffline(): boolean {
    return this.document.defaultView?.navigator.onLine === false;
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidResponseError('JSON illisible');
  }
}
