import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";

import { useChatHistory, useSendMessage, useClearHistory } from "./useChatHooks";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { data: messages = [], isLoading } = useChatHistory();
  const sendMessage = useSendMessage();
  const clearHistory = useClearHistory();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => clearHistory.mutate()}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-sm text-gray-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-gray-500 mt-8">
            Hi! I can help you manage your tasks and shopping lists. Try saying
            &quot;What do I have today?&quot; or &quot;Add milk to my grocery
            list&quot;.
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageBubble key={msg.id} message={msg} />
          ))
        )}
        {sendMessage.isPending && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={(message) => sendMessage.mutate(message)}
        disabled={sendMessage.isPending}
      />
    </div>
  );
}
