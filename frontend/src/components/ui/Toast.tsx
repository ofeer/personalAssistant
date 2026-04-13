import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "success") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3000);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all animate-in slide-in-from-bottom-2",
              toast.type === "success" && "bg-primary text-primary-foreground",
              toast.type === "error" &&
                "bg-destructive text-destructive-foreground",
              toast.type === "info" && "bg-muted text-foreground",
            )}
          >
            {toast.message}
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
