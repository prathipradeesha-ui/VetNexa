import { env } from '../config/env';
import { HttpError } from './http-error';
import { logger } from './logger';

/** Assessment returned by the Python service (services/ai/vetnexa_ai/assessment.py). */
export interface AiAssessment {
  status: 'ASSESSED' | 'UNCERTAIN' | 'REJECTED_QUALITY';
  predictedClass: string | null;
  confidence: number | null;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'UNCERTAIN';
  referToVet: boolean;
  escalated: boolean;
  summary: string;
  guidance: string;
  probabilities: Record<string, number>;
  modelVersion: string;
  demoModel: boolean;
  disclaimer: string;
  quality: { ok: boolean; problems: string[] };
}

export interface AiHealth {
  modelLoaded: boolean;
  modelVersion: string | null;
  demoModel: boolean | null;
}

/** What the rest of the API needs from the AI service. Tests pass in a fake. */
export interface AiClient {
  assess(image: Buffer, contentType: string): Promise<AiAssessment>;
  health(): Promise<AiHealth>;
}

const unavailable = () =>
  HttpError.serviceUnavailable(
    'The AI assessment service is not available right now. If you are worried about your ' +
      'pet, please contact a veterinarian.',
  );

/**
 * HTTP client for the internal AI service. Network failures, time-outs and unexpected answers
 * all become a friendly 503, so an AI outage never breaks the rest of the platform.
 */
export function httpAiClient(
  baseUrl = env.AI_SERVICE_URL,
  token = env.AI_SERVICE_TOKEN,
  timeoutMs = env.AI_TIMEOUT_MS,
): AiClient {
  const headers: Record<string, string> = token ? { 'x-service-token': token } : {};

  async function call(path: string, init: RequestInit = {}) {
    try {
      return await fetch(new URL(path, baseUrl), {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string>) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      logger.warn({ err: error, path }, 'AI service unreachable');
      throw unavailable();
    }
  }

  return {
    async assess(image, contentType) {
      const response = await call('/assess', {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: new Uint8Array(image),
      });
      if (response.status === 422) {
        throw HttpError.validation(
          [{ field: 'photo', message: 'This file is not a valid image' }],
          'This file is not a valid image',
        );
      }
      if (!response.ok) {
        logger.warn({ status: response.status }, 'AI service refused an assessment');
        throw unavailable();
      }
      return (await response.json()) as AiAssessment;
    },

    async health() {
      const response = await call('/health');
      if (!response.ok) throw unavailable();
      return (await response.json()) as AiHealth;
    },
  };
}
