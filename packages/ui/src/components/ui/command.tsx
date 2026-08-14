"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type CommandItemRecord = {
  id: string;
  groupId: string | null;
  value: string;
  text: string;
  disabled?: boolean;
  visible: boolean;
  ref: React.RefObject<HTMLButtonElement | null>;
  onSelect?: () => void;
};

type CommandContextValue = {
  query: string;
  setQuery: (query: string) => void;
  items: CommandItemRecord[];
  registerItem: (item: CommandItemRecord) => void;
  unregisterItem: (id: string) => void;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  selectActive: () => void;
};

const CommandContext = React.createContext<CommandContextValue | null>(null);
const CommandGroupContext = React.createContext<string | null>(null);

function useCommandContext() {
  const context = React.useContext(CommandContext);
  if (!context) {
    throw new Error("Command components must be used within <Command />");
  }
  return context;
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
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const isInside = refs.some((ref) => ref.current?.contains(target));
      if (!isInside) onDismiss();
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


function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

function useControllableQuery({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
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

  return [currentValue ?? "", setValue] as const;
}


const Command = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
  }
>(({ className, value, defaultValue, onValueChange, children, ...props }, ref) => {
  const [query, setQuery] = useControllableQuery({ value, defaultValue, onValueChange });
  const [items, setItems] = React.useState<CommandItemRecord[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const registerItem = React.useCallback((item: CommandItemRecord) => {
    setItems((current) => {
      const next = current.filter((entry) => entry.id !== item.id);
      return [...next, item];
    });
  }, []);

  const unregisterItem = React.useCallback((id: string) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const visibleItems = React.useMemo(
    () => items.filter((item) => item.visible && !item.disabled),
    [items],
  );

  React.useEffect(() => {
    if (visibleItems.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !visibleItems.some((item) => item.id === activeId)) {
      setActiveId(visibleItems[0].id);
    }
  }, [activeId, visibleItems]);

  const selectActive = React.useCallback(() => {
    const current = visibleItems.find((item) => item.id === activeId);
    current?.onSelect?.();
  }, [activeId, visibleItems]);

  const context = React.useMemo(
    () => ({
      query,
      setQuery,
      items,
      registerItem,
      unregisterItem,
      activeId,
      setActiveId,
      selectActive,
    }),
    [activeId, items, query, registerItem, selectActive, setQuery, unregisterItem],
  );

  return (
    <CommandContext.Provider value={context}>
      <div
        ref={ref}
        className={cn(
          "flex h-full w-full flex-col overflow-hidden rounded-md bg-surface-container-lowest text-on-surface",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  );
});
Command.displayName = "Command";

type CommandDialogProps = React.PropsWithChildren<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

const CommandDialog = ({ open = false, onOpenChange, children }: CommandDialogProps) => {
  const mounted = useMounted();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  useDismissableLayer(open, [panelRef, contentRef], () => onOpenChange?.(false));

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 cursor-default bg-inverse-surface/40 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center px-4 pt-24 sm:pt-32">
        <div
          ref={panelRef}
          className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-lg border border-outline-variant/25 bg-surface-container-lowest shadow-lg"
        >
          <Command ref={contentRef} className="[&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:font-medium [&_[data-cmdk-group-heading]]:text-on-surface-variant [&_[data-cmdk-group]:not([hidden])_~[data-cmdk-group]]:pt-0 [&_[data-cmdk-group]]:px-2 [&_[data-cmdk-input-wrapper]_svg]:h-5 [&_[data-cmdk-input-wrapper]_svg]:w-5 [&_[data-cmdk-input]]:h-12 [&_[data-cmdk-item]]:px-2 [&_[data-cmdk-item]]:py-3 [&_[data-cmdk-item]_svg]:h-5 [&_[data-cmdk-item]_svg]:w-5">
            {children}
          </Command>
        </div>
      </div>
    </div>,
    document.body,
  );
};

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const CommandInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, onChange, onKeyDown, ...props }, ref) => {
  const { query, setQuery, selectActive, items, activeId, setActiveId } = useCommandContext();
  const visibleItems = items.filter((item) => item.visible && !item.disabled);

  return (
    <div className="flex items-center border-b border-outline-variant/20 px-3" data-cmdk-input-wrapper="">
      <SearchGlyph className="mr-2 h-4 w-4 shrink-0 text-on-surface-variant" />
      <input
        ref={ref}
        value={query}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-on-surface-variant/70 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        onChange={(event) => {
          onChange?.(event);
          if (!event.defaultPrevented) {
            setQuery(event.target.value);
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || visibleItems.length === 0) return;

          const currentIndex = visibleItems.findIndex((item) => item.id === activeId);
          const nextIndex = currentIndex >= 0 ? currentIndex : 0;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            const next = visibleItems[(nextIndex + 1) % visibleItems.length];
            setActiveId(next.id);
            next.ref.current?.focus();
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            const next = visibleItems[(nextIndex - 1 + visibleItems.length) % visibleItems.length];
            setActiveId(next.id);
            next.ref.current?.focus();
          } else if (event.key === "Enter") {
            event.preventDefault();
            selectActive();
          }
        }}
        {...props}
      />
    </div>
  );
});
CommandInput.displayName = "CommandInput";

const CommandList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="listbox"
    aria-orientation="vertical"
    className={cn("max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden p-1", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

const CommandEmpty = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { items, query } = useCommandContext();
    const visibleCount = items.filter((item) => item.visible && !item.disabled).length;
    if (visibleCount > 0 || !query.trim()) {
      return null;
    }
    return (
      <div ref={ref} className={cn("py-6 text-center text-sm text-on-surface-variant", className)} {...props}>
        {children}
      </div>
    );
  },
);
CommandEmpty.displayName = "CommandEmpty";

const CommandGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { heading?: React.ReactNode }
>(({ className, heading, children, ...props }, ref) => {
  const { items, query } = useCommandContext();
  const groupId = React.useId();
  const visibleCount = items.filter((item) => item.groupId === groupId && item.visible && !item.disabled).length;

  return (
    <CommandGroupContext.Provider value={groupId}>
      <div
        ref={ref}
        hidden={query.trim().length > 0 && visibleCount === 0}
        className={cn(
          "overflow-hidden p-1 text-on-surface [&_[data-cmdk-group-heading]]:px-2 [&_[data-cmdk-group-heading]]:py-1.5 [&_[data-cmdk-group-heading]]:text-xs [&_[data-cmdk-group-heading]]:font-semibold [&_[data-cmdk-group-heading]]:text-on-surface-variant",
          className,
        )}
        {...props}
      >
        {heading ? <div data-cmdk-group-heading="">{heading}</div> : null}
        {children}
      </div>
    </CommandGroupContext.Provider>
  );
});
CommandGroup.displayName = "CommandGroup";

const CommandSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr ref={ref} className={cn("-mx-1 h-px border-0 bg-outline-variant/25", className)} {...props} />
  ),
);
CommandSeparator.displayName = "CommandSeparator";

const CommandItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string;
    keywords?: string[];
    onSelect?: (value: string) => void;
  }
>(({ className, value, keywords, onSelect, disabled, onClick, onMouseEnter, children, ...props }, ref) => {
  const { query, registerItem, unregisterItem, activeId, setActiveId } = useCommandContext();
  const groupId = React.useContext(CommandGroupContext);
  const itemRef = React.useRef<HTMLButtonElement | null>(null);
  const id = React.useId();
  const text = React.useMemo(() => {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    return value;
  }, [children, value]);
  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [value, text, ...(keywords ?? [])].join(" ").toLowerCase().includes(needle);
  }, [keywords, query, text, value]);

  React.useEffect(() => {
    registerItem({
      id,
      groupId,
      value,
      text,
      visible,
      disabled,
      ref: itemRef,
      onSelect: onSelect ? () => onSelect(value) : undefined,
    });
    return () => unregisterItem(id);
  }, [disabled, groupId, id, onSelect, registerItem, text, unregisterItem, value, visible]);

  return (
    <button
      ref={(node) => {
        itemRef.current = node;
        assignRef(ref, node);
      }}
      type="button"
      role="option"
      aria-selected={activeId === id}
      disabled={disabled}
      hidden={!visible}
      data-cmdk-item=""
      data-selected={activeId === id ? "true" : "false"}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none aria-selected:bg-surface-container-high aria-selected:text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        activeId === id && "bg-surface-container-high text-primary",
        className,
      )}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (!event.defaultPrevented && !disabled) {
          setActiveId(id);
        }
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onSelect?.(value);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
CommandItem.displayName = "CommandItem";

function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ml-auto text-[10px] font-medium tracking-widest text-on-surface-variant", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
