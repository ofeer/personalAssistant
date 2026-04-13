export interface IChatAction {
  tool_name: string;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  success: boolean;
  error: string | null;
}

export interface IChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: IChatAction[] | null;
  created_at: string;
  isError?: boolean;
}

export interface IChatHistoryResponse {
  messages: IChatMessage[];
}
