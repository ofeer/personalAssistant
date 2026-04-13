import { MessageCircle } from "lucide-react";

interface ChatToggleButtonProps {
  onClick: () => void;
}

export function ChatToggleButton({ onClick }: ChatToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 hover:scale-105 active:scale-95"
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}
