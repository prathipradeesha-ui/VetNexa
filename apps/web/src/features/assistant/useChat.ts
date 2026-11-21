import type { ChatHistoryMessage, ChatReply } from '@vetnexa/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

export interface ChatEntry {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  reply: ChatReply | null;
}

const historyKey = ['chat', 'history'] as const;
let localId = 0;
const nextId = () => `local-${++localId}`;

/**
 * The conversation shown on screen. Signed-in users start from their saved history; visitors
 * start empty and nothing is kept after they leave the page.
 */
export function useChat(signedIn: boolean) {
  const queryClient = useQueryClient();
  const [added, setAdded] = useState<ChatEntry[]>([]);

  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => api<{ messages: ChatHistoryMessage[] }>('/chat/history').then((r) => r.messages),
    enabled: signedIn,
    staleTime: Infinity,
  });

  const send = useMutation({
    mutationFn: (message: string) =>
      api<{ reply: ChatReply }>('/chat', { method: 'POST', body: { message } }).then(
        (r) => r.reply,
      ),
    onMutate: (message) => {
      setAdded((list) => [
        ...list,
        { id: nextId(), sender: 'USER', content: message, reply: null },
      ]);
    },
    onSuccess: (reply, message) => {
      if (!signedIn) {
        setAdded((list) => [
          ...list,
          { id: nextId(), sender: 'ASSISTANT', content: reply.text, reply },
        ]);
        return;
      }
      // The API saved both messages: add them to the cached history so they are still there
      // after the user leaves the page and comes back.
      const now = new Date().toISOString();
      queryClient.setQueryData<ChatHistoryMessage[]>(historyKey, (old = []) => [
        ...old,
        { id: nextId(), sender: 'USER', content: message, reply: null, createdAt: now },
        { id: nextId(), sender: 'ASSISTANT', content: reply.text, reply, createdAt: now },
      ]);
      setAdded([]);
    },
  });

  const clear = useMutation({
    mutationFn: () => api<void>('/chat/history', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueryData(historyKey, []);
      setAdded([]);
    },
  });

  const saved: ChatEntry[] = (signedIn ? (history.data ?? []) : []).map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    reply: m.reply,
  }));

  return {
    messages: [...saved, ...added],
    loadingHistory: signedIn && history.isPending,
    send,
    clear,
    reset: () => setAdded([]),
  };
}
