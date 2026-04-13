import { useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { ChatToggleButton } from "./ChatToggleButton";
import { ChatPanel } from "./ChatPanel";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  if (!user) return null;

  return (
    <>
      {!isOpen && <ChatToggleButton onClick={() => setIsOpen(true)} />}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 h-[calc(100vh-4rem)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[600px] sm:w-[400px] sm:rounded-2xl sm:shadow-2xl sm:border dark:sm:border-gray-700 overflow-hidden">
          <ChatPanel onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
}
