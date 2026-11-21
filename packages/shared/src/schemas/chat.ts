import { z } from 'zod';

export const CHAT_MAX_CHARS = 500;

/** A question typed into the pet-care assistant. */
export const chatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Please type a question')
    .max(CHAT_MAX_CHARS, `Please keep questions under ${CHAT_MAX_CHARS} characters`),
});

export type ChatMessageData = z.infer<typeof chatMessageSchema>;

export interface ChatLink {
  label: string;
  href: string;
}

export interface ChatArticleSection {
  heading: string;
  text: string;
  items: string[];
}

export interface ChatArticle {
  id: string;
  title: string;
  category: string;
  urgency: 'routine' | 'see-vet' | 'emergency';
  species: string[];
  summary: string;
  sections: ChatArticleSection[];
  sources: string[];
}

/** The assistant's structured reply (built by services/ai/vetnexa_ai/chat/assistant.py). */
export interface ChatReply {
  kind: 'answer' | 'emergency' | 'redirect' | 'fallback' | 'smalltalk';
  text: string;
  emergency: { reason: string; steps: string[] } | null;
  article: ChatArticle | null;
  related: { id: string; title: string; question: string }[];
  suggestions: string[];
  actions: ChatLink[];
  score: number | null;
  disclaimer: string;
}

/** One stored message in a signed-in user's conversation. */
export interface ChatHistoryMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  reply: ChatReply | null;
  createdAt: string;
}
