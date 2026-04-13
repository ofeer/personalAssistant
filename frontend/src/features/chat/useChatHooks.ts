import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { useAuth } from "@/hooks/useAuth";
import type { IChatMessage } from "@/types/chat";
import { chatApi } from "./api";

function getErrorMessage(error: unknown): string {
  if (!isAxiosError(error) || !error.response) {
    return "Something went wrong. Please try again or rephrase your message.";
  }
  const status = error.response.status;
  if (status === 422) {
    return "Your message is too long. Try breaking it into smaller parts.";
  }
  if (status === 429) {
    return "I'm a bit busy right now, try again in a moment.";
  }
  if (status === 503) {
    return "I'm temporarily unavailable, please try again.";
  }
  const detail = error.response.data?.detail;
  if (typeof detail === "string") {
    return detail;
  }
  return "Something went wrong. Please try again or rephrase your message.";
}

const CHAT_HISTORY_KEY = ["chat-history"];

export function useChatHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CHAT_HISTORY_KEY,
    queryFn: () => chatApi.getHistory(),
    enabled: !!user,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => chatApi.sendMessage(message),
    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: CHAT_HISTORY_KEY });
      const previous =
        queryClient.getQueryData<IChatMessage[]>(CHAT_HISTORY_KEY);

      const optimisticMsg: IChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        actions: null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<IChatMessage[]>(CHAT_HISTORY_KEY, (old) => [
        ...(old ?? []),
        optimisticMsg,
      ]);

      return { previous };
    },
    onSuccess: (response) => {
      queryClient.setQueryData<IChatMessage[]>(CHAT_HISTORY_KEY, (old) => {
        if (!old) return [response];
        const withoutTemp = old.filter(
          (msg) => !msg.id.startsWith("temp-") || msg.role !== "user",
        );
        return [...withoutTemp, response];
      });
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CHAT_HISTORY_KEY, context.previous);
      }
      const errorMsg: IChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: getErrorMessage(error),
        actions: null,
        created_at: new Date().toISOString(),
        isError: true,
      };
      queryClient.setQueryData<IChatMessage[]>(CHAT_HISTORY_KEY, (old) => [
        ...(old ?? []),
        errorMsg,
      ]);
    },
    onSettled: (_data, error) => {
      if (!error) {
        queryClient.invalidateQueries({ queryKey: CHAT_HISTORY_KEY });
      }
      queryClient.invalidateQueries({ queryKey: ["shopping-lists"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => chatApi.clearHistory(),
    onSuccess: () => {
      queryClient.setQueryData(CHAT_HISTORY_KEY, []);
    },
  });
}
