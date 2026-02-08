"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface PopoverContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  onOpenChange: () => {},
  triggerRef: { current: null },
});

function Popover({
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const onOpenChange = controlledOnOpenChange ?? setUncontrolledOpen;
  const triggerRef = React.useRef<HTMLDivElement>(null);

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef }}>
      <div className="relative">{children}</div>
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const { open, onOpenChange, triggerRef } = React.useContext(PopoverContext);

  if (asChild && React.isValidElement(children)) {
    return (
      <div ref={triggerRef}>
        {React.cloneElement(
          children as React.ReactElement<{ onClick?: () => void }>,
          {
            onClick: () => onOpenChange(!open),
          }
        )}
      </div>
    );
  }

  return (
    <div ref={triggerRef}>
      <button type="button" onClick={() => onOpenChange(!open)}>
        {children}
      </button>
    </div>
  );
}

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    align?: "start" | "center" | "end";
    sideOffset?: number;
  }
>(({ className, align = "start", sideOffset = 4, children, ...props }, ref) => {
  const { open, onOpenChange, triggerRef } = React.useContext(PopoverContext);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Position the popover relative to the trigger
  React.useEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePos() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const calH = 360;
      const spaceBelow = viewportH - rect.bottom;
      const openUp = spaceBelow < calH && rect.top > calH;

      const top = openUp
        ? rect.top + window.scrollY - calH - sideOffset
        : rect.bottom + window.scrollY + sideOffset;

      let left: number;
      if (align === "end") {
        left = rect.right + window.scrollX;
      } else if (align === "center") {
        left = rect.left + window.scrollX + rect.width / 2;
      } else {
        left = rect.left + window.scrollX;
      }

      // Clamp to viewport: prevent overflow on the right
      const contentEl = contentRef.current;
      if (contentEl) {
        const contentWidth = contentEl.offsetWidth;
        const viewportW = window.innerWidth;
        if (align === "end") {
          // For end-aligned, the right edge of content = left, so left edge = left - contentWidth
          const rightEdge = left;
          if (rightEdge > viewportW - 8) {
            left = viewportW - 8;
          }
          const leftEdge = left - contentWidth;
          if (leftEdge < 8) {
            left = contentWidth + 8;
          }
        } else {
          if (left + contentWidth > viewportW - 8) {
            left = viewportW - contentWidth - 8;
          }
          if (left < 8) left = 8;
        }
      }

      setPos({ top, left });
    }

    updatePos();

    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, triggerRef, align, sideOffset]);

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onOpenChange(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open || !mounted) return null;

  const content = (
    <div
      ref={(node) => {
        (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "z-[100] rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-xl outline-none",
        className
      )}
      style={{
        position: "absolute",
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        transform: align === "center" ? "translateX(-50%)" : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );

  return createPortal(content, document.body);
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent };
