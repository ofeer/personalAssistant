import { AlertCircle } from "lucide-react";

import type { IChatMessage } from "@/types/chat";
import { ChatActionCard } from "./ChatActionCard";

interface ChatMessageBubbleProps {
  message: IChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  const bubbleClass = message.isError
    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : isUser
      ? "bg-indigo-600 text-white"
      : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] space-y-1">
        <div
          className={`rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${bubbleClass}`}
        >
          {message.isError && (
            <AlertCircle size={14} className="inline-block mr-1.5 -mt-0.5" />
          )}
          {message.content}
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-col gap-1">
            {message.actions.map((action, idx) => (
              <ChatActionCard key={idx} action={action} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
