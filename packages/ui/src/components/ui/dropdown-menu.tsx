"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type FloatingOptions = {
  sideOffset?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
};

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

function useDismissableLayer(
  enabled: boolean,
  refs: Array<React.RefObject<HTMLElement | null>>,
  onDismiss: () => void,
) {
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onDismiss();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, onDismiss, refs]);
}

function useFloatingStyle(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  options: FloatingOptions = {},
) {
  const { sideOffset = 4, side = "bottom", align = "start" } = options;
  const [style, setStyle] = React.useState<React.CSSProperties>({});

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const update = () => {
      const trigger = triggerRef.current;
      const content = contentRef.current;
      if (!trigger || !content) return;

      const rect = trigger.getBoundingClientRect();
      const contentWidth = Math.max(rect.width, 176);
      const contentHeight = content.getBoundingClientRect().height || 0;

      let top = rect.bottom + sideOffset;
      let left = rect.left;

      if (side === "top") {
        top = rect.top - sideOffset - contentHeight;
      } else if (side === "left") {
        left = rect.left - contentWidth - sideOffset;
        top = rect.top;
      } else if (side === "right") {
        left = rect.right + sideOffset;
        top = rect.top;
      }

      if (align === "center") {
        left = rect.left + rect.width / 2 - contentWidth / 2;
      } else if (align === "end") {
        left = rect.right - contentWidth;
      }

      setStyle({
        position: "fixed",
        top: Math.max(8, Math.min(top, window.innerHeight - Math.max(contentHeight, 48) - 8)),
        left: Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8)),
        minWidth: contentWidth,
      });
    };

    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [align, contentRef, open, side, sideOffset, triggerRef]);

  return style;
}

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  contentId: string;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenuContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("DropdownMenu components must be used within <DropdownMenu />");
  }
  return context;
}

function useControllableOpen({
  open,
  defaultOpen,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const isControlled = open !== undefined;
  const currentOpen = isControlled ? open : internalOpen;

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return [Boolean(currentOpen), setOpen] as const;
}

const DropdownMenu = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>) => {
  const [currentOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentId = React.useId();

  const value = React.useMemo(
    () => ({ open: currentOpen, setOpen, triggerRef, contentId }),
    [currentOpen, contentId, setOpen],
  );

  return <DropdownMenuContext.Provider value={value}>{children}</DropdownMenuContext.Provider>;
};
DropdownMenu.displayName = "DropdownMenu";

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild = false, onClick, children, type = "button", ...props }, ref) => {
  const { open, setOpen, triggerRef, contentId } = useDropdownMenuContext();
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (!event.defaultPrevented) setOpen(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ...props,
      onClick: handleClick,
      "aria-expanded": open,
      "aria-haspopup": "menu",
      "aria-controls": contentId,
    });
  }

  return (
    <button
      ref={(node) => {
        triggerRef.current = node;
        assignRef(ref, node);
      }}
      type={type}
      aria-expanded={open}
      aria-haspopup="menu"
      aria-controls={contentId}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="group" className={cn("p-0", className)} {...props} />,
);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

const DropdownMenuPortal = ({ children }: { children: React.ReactNode }) => {
  const mounted = useMounted();
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
};
DropdownMenuPortal.displayName = "DropdownMenuPortal";

type SubContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
};

const DropdownMenuSubContext = React.createContext<SubContextValue | null>(null);

function useSubContext() {
  const context = React.useContext(DropdownMenuSubContext);
  if (!context) {
    throw new Error("DropdownMenu.Sub components must be used within <DropdownMenuSub />");
  }
  return context;
}

const DropdownMenuSub = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: React.PropsWithChildren<{
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}>) => {
  const [currentOpen, setOpen] = useControllableOpen({ open, defaultOpen, onOpenChange });
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const value = React.useMemo(() => ({ open: currentOpen, setOpen, triggerRef }), [currentOpen, setOpen]);
  return <DropdownMenuSubContext.Provider value={value}>{children}</DropdownMenuSubContext.Provider>;
};
DropdownMenuSub.displayName = "DropdownMenuSub";

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    sideOffset?: number;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
  }
>(({ className, sideOffset = 4, side = "bottom", align = "start", children, ...props }, ref) => {
  const { open, setOpen, triggerRef, contentId } = useDropdownMenuContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const mounted = useMounted();
  const style = useFloatingStyle(open, triggerRef, contentRef, { sideOffset, side, align });

  useDismissableLayer(open, [triggerRef, contentRef], () => setOpen(false));

  if (!open || !mounted) return null;

  return (
    <DropdownMenuPortal>
      <div
        ref={(node) => {
          contentRef.current = node;
          assignRef(ref, node);
        }}
        id={contentId}
        role="menu"
        aria-orientation="vertical"
        style={style}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border border-outline-variant/25 bg-surface-container-lowest p-1 text-on-surface shadow-md",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </DropdownMenuPortal>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }
>(({ className, inset, children, onClick, onMouseEnter, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSubContext();
  return (
    <button
      ref={(node) => {
        triggerRef.current = node;
        assignRef(ref, node);
      }}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn(
        "flex w-full cursor-default select-none items-center rounded px-2 py-1.5 text-sm outline-none focus:bg-surface-container-high data-[state=open]:bg-surface-container-high",
        inset && "pl-8",
        className,
      )}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
    >
      {children}
      <span className="ml-auto text-xs opacity-60">›</span>
    </button>
  );
});
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, triggerRef } = useSubContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const mounted = useMounted();
  const style = useFloatingStyle(open, triggerRef, contentRef, { side: "right", align: "start" });

  useDismissableLayer(open, [triggerRef, contentRef], () => setOpen(false));

  if (!open || !mounted) return null;

  return (
    <DropdownMenuPortal>
      <div
        ref={(node) => {
          contentRef.current = node;
          assignRef(ref, node);
        }}
        role="menu"
        aria-orientation="vertical"
        style={style}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border border-outline-variant/25 bg-surface-container-lowest p-1 text-on-surface shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </DropdownMenuPortal>
  );
});
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean; onSelect?: (event: Event) => void }
>(({ className, inset, onSelect, onClick, children, disabled, ...props }, ref) => {
  const { setOpen } = useDropdownMenuContext();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      disabled={disabled}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded px-2 py-1.5 text-left text-sm outline-none transition-colors focus:bg-surface-container-high data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        inset && "pl-8",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onSelect?.(event.nativeEvent);
        if (!disabled) setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn("-mx-1 my-1 h-px border-0 bg-outline-variant/30", className)} {...props} />,
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <div
    ref={ref}
    role="presentation"
    className={cn("px-2 py-1.5 text-sm font-semibold text-primary", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuRadioGroup = ({
  children,
  ...props
}: React.PropsWithChildren<{
  value?: string;
  onValueChange?: (value: string) => void;
}> & React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div role="group" aria-label="radio group" {...props}>
      {children}
    </div>
  );
};
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
