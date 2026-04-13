import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function SlideOver({
  open,
  onClose,
  title,
  children,
  className,
}: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-card shadow-xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </>
  );
}
