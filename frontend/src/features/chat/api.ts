import { api } from "@/lib/api";
import type { IChatHistoryResponse, IChatMessage } from "@/types/chat";

export const chatApi = {
  sendMessage: (message: string) =>
    api
      .post<IChatMessage>("/chat/message", { message })
      .then((res) => res.data),

  getHistory: (limit = 50) =>
    api
      .get<IChatHistoryResponse>("/chat/history", { params: { limit } })
      .then((res) => res.data.messages),

  clearHistory: () => api.delete("/chat/history"),
};
