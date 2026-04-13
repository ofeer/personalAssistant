import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="flex items-end gap-2 border-t p-3 dark:border-gray-700">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
