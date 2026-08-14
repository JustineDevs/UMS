"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type SelectItemRecord = {
  value: string;
  label: React.ReactNode;
  text: string;
  disabled?: boolean;
};

type SelectContextValue = {
  value: string | undefined;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  contentId: string;
  items: SelectItemRecord[];
  registerItem: (item: SelectItemRecord) => void;
  unregisterItem: (value: string) => void;
  highlightedValue: string | null;
  setHighlightedValue: (value: string | null) => void;
};

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = React.useContext(SelectContext);
  if (!context) {
    throw new Error("Select components must be used within <Select />");
  }
  return context;
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function useControllableValue({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  return [currentValue, setValue] as const;
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
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
) {
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
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - contentWidth - 8));
      const top = Math.max(
        8,
        Math.min(rect.bottom + 4, window.innerHeight - Math.max(contentHeight, 48) - 8),
      );

      setStyle({ position: "fixed", top, left, minWidth: contentWidth });
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
  }, [contentRef, open, triggerRef]);

  return style;
}

const Select = ({
  value,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
}: React.PropsWithChildren<{
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}>) => {
  const [currentValue, setValue] = useControllableValue({ value, defaultValue, onValueChange });
  const [open, setOpen] = React.useState(false);
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const contentId = React.useId();
  const [items, setItems] = React.useState<SelectItemRecord[]>([]);

  const registerItem = React.useCallback((item: SelectItemRecord) => {
    setItems((current) => {
      const next = current.filter((entry) => entry.value !== item.value);
      return [...next, item];
    });
  }, []);

  const unregisterItem = React.useCallback((valueToRemove: string) => {
    setItems((current) => current.filter((entry) => entry.value !== valueToRemove));
  }, []);

  React.useEffect(() => {
    if (!open) {
      setHighlightedValue(null);
      return;
    }
    const selected = items.find((item) => item.value === currentValue && !item.disabled);
    const firstEnabled = items.find((item) => !item.disabled);
    setHighlightedValue(selected?.value ?? firstEnabled?.value ?? null);
  }, [currentValue, items, open]);

  const contextValue = React.useMemo(
    () => ({
      value: currentValue,
      setValue,
      open,
      setOpen,
      disabled,
      triggerRef,
      contentRef,
      contentId,
      items,
      registerItem,
      unregisterItem,
      highlightedValue,
      setHighlightedValue,
    }),
    [
      currentValue,
      disabled,
      highlightedValue,
      items,
      open,
      registerItem,
      setValue,
      unregisterItem,
    ],
  );

  return <SelectContext.Provider value={contextValue}>{children}</SelectContext.Provider>;
};
Select.displayName = "Select";

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="group" className={className} {...props} />,
);
SelectGroup.displayName = "SelectGroup";

const SelectValue = ({ placeholder }: { placeholder?: React.ReactNode }) => {
  const { value, items } = useSelectContext();
  const selected = items.find((item) => item.value === value);
  return <>{selected?.label ?? placeholder ?? null}</>;
};
SelectValue.displayName = "SelectValue";

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, onClick, onKeyDown, disabled, id, ...props }, ref) => {
  const { open, setOpen, disabled: selectDisabled, triggerRef, contentId } = useSelectContext();
  const isDisabled = Boolean(disabled || selectDisabled);

  return (
    <button
      ref={(node) => {
        triggerRef.current = node;
        assignRef(ref, node);
      }}
      type="button"
      id={id}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={contentId}
      disabled={isDisabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded border border-outline-variant/30 bg-surface-container-high px-3 py-2 text-xs font-medium uppercase tracking-wider text-on-surface ring-offset-background placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || isDisabled) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(true);
        }
      }}
      {...props}
    >
      {children}
      <span className="opacity-60" aria-hidden>
        ▾
      </span>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { position?: "item-aligned" | "popper" }
>(({ className, children, position = "popper", ...props }, ref) => {
  const {
    open,
    setOpen,
    triggerRef,
    contentRef,
    contentId,
    items,
    value,
    setValue,
    highlightedValue,
    setHighlightedValue,
  } = useSelectContext();
  const mounted = useMounted();
  const style = useFloatingStyle(open, triggerRef, contentRef);

  useDismissableLayer(open, [triggerRef, contentRef], () => setOpen(false));

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const enabledItems = items.filter((item) => !item.disabled);
      if (enabledItems.length === 0) return;
      const currentIndex = enabledItems.findIndex((item) => item.value === (highlightedValue ?? value));
      const startIndex = currentIndex >= 0 ? currentIndex : 0;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = enabledItems[(startIndex + 1) % enabledItems.length];
        setHighlightedValue(next.value);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const next = enabledItems[(startIndex - 1 + enabledItems.length) % enabledItems.length];
        setHighlightedValue(next.value);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const next = enabledItems.find((item) => item.value === (highlightedValue ?? value));
        if (next) {
          setValue(next.value);
          setOpen(false);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [highlightedValue, items, open, setHighlightedValue, setOpen, setValue, value]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      ref={(node) => {
        contentRef.current = node;
        assignRef(ref, node);
      }}
      id={contentId}
      role="listbox"
      aria-orientation="vertical"
      style={style}
      className={cn(
        "z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-outline-variant/25 bg-surface-container-lowest text-on-surface shadow-md",
        position === "popper" && "",
        className,
      )}
      {...props}
    >
      <div className="p-1">{children}</div>
    </div>,
    document.body,
  );
});
SelectContent.displayName = "SelectContent";

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="presentation" className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
  ),
);
SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; textValue?: string }
>(({ className, children, value, disabled, onClick, onMouseEnter, ...props }, ref) => {
  const { value: selectedValue, setValue, setOpen, highlightedValue, setHighlightedValue, registerItem, unregisterItem } =
    useSelectContext();
  const itemRef = React.useRef<HTMLButtonElement | null>(null);
  const text = React.useMemo(() => {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    return value;
  }, [children, value]);

  React.useEffect(() => {
    registerItem({ value, label: children, text, disabled });
    return () => unregisterItem(value);
  }, [children, disabled, registerItem, text, unregisterItem, value]);

  return (
    <button
      ref={(node) => {
        itemRef.current = node;
        assignRef(ref, node);
      }}
      type="button"
      role="option"
      aria-selected={selectedValue === value}
      disabled={disabled}
      data-state={selectedValue === value ? "checked" : "unchecked"}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded px-2 py-1.5 text-sm outline-none focus:bg-surface-container-high focus:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        highlightedValue === value && "bg-surface-container-high text-primary",
        className,
      )}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented && !disabled) setHighlightedValue(value);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        setValue(value);
        setOpen(false);
      }}
      {...props}
    >
      <span className="w-full text-left">{children}</span>
    </button>
  );
});
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr ref={ref} className={cn("-mx-1 my-1 h-px border-0 bg-outline-variant/30", className)} {...props} />
  ),
);
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
};
