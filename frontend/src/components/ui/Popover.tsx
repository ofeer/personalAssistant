import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export function Popover({ trigger, children, align = "left" }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 160;

    let left = align === "right" ? rect.right - dropdownWidth : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - dropdownWidth - 8));

    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = 200;
    const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4;

    setPosition({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    const handleScroll = () => setOpen(false);

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-block"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        {trigger}
      </div>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] min-w-[140px] rounded-md border border-border bg-card p-1 shadow-lg"
            style={{ top: position.top, left: position.left }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

export function PopoverItem({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs transition-colors hover:bg-muted ${
        active ? "bg-muted font-medium" : ""
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
