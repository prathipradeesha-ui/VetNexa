import type { ChatReply, SkinCheck, SymptomEvidence, TriageDetails } from '@vetnexa/shared';
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
  symptoms: SymptomEvidence | null;
  /** Null only when the photo was rejected for quality without red flags. */
  triage: TriageDetails | null;
  ood: { familiarity: number; outOfDistribution: boolean } | null;
  /** Advisory only; missing from older AI service versions. */
  skinCheck?: SkinCheck | null;
}

export interface AiHealth {
  modelLoaded: boolean;
  modelVersion: string | null;
  demoModel: boolean | null;
}

/** What the rest of the API needs from the AI service. Tests pass in a fake. */
export interface AiClient {
  /** `answers` are the questionnaire answers plus the pet's species ('dog' or 'cat'). */
  assess(image: Buffer, contentType: string, answers?: object): Promise<AiAssessment>;
  health(): Promise<AiHealth>;
  chat(message: string): Promise<ChatReply>;
}

const unavailable = () =>
  HttpError.serviceUnavailable(
    'The VetNexa AI service is not available right now. If you are worried about your pet, ' +
      'please contact a veterinarian.',
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
    async assess(image, contentType, answers) {
      // Multipart form: the photo plus the questionnaire answers as JSON.
      const form = new FormData();
      form.append('image', new Blob([new Uint8Array(image)], { type: contentType }), 'photo');
      if (answers) form.append('answers', JSON.stringify(answers));
      const response = await call('/assess', { method: 'POST', body: form });
      if (response.status === 422) {
        const detail = (await response.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        if (detail?.error?.code === 'INVALID_ANSWERS') {
          throw HttpError.validation([
            { field: 'answers', message: 'Some symptom answers are not valid' },
          ]);
        }
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

    async chat(message) {
      const response = await call('/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, 'AI service refused a chat message');
        throw HttpError.serviceUnavailable(
          'The pet-care assistant is not available right now. If your pet seems unwell or ' +
            'you think it is an emergency, please contact a veterinarian.',
        );
      }
      return (await response.json()) as ChatReply;
    },

    async health() {
      const response = await call('/health');
      if (!response.ok) throw unavailable();
      return (await response.json()) as AiHealth;
    },
  };
}
