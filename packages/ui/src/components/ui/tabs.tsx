"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

type TabsContextValue = {
  value: string | undefined;
  setValue: (value: string) => void;
  orientation: "horizontal" | "vertical";
  triggerRefs: React.MutableRefObject<Array<HTMLButtonElement | null>>;
  triggerValues: React.MutableRefObject<Array<string>>;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within <Tabs />");
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

const Tabs = ({
  value,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  children,
}: React.PropsWithChildren<{
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
}>) => {
  const [currentValue, setValue] = useControllableValue({ value, defaultValue, onValueChange });
  const triggerRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const triggerValues = React.useRef<Array<string>>([]);

  const context = React.useMemo(
    () => ({ value: currentValue, setValue, orientation, triggerRefs, triggerValues }),
    [currentValue, orientation, setValue],
  );

  return <TabsContext.Provider value={context}>{children}</TabsContext.Provider>;
};
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, onKeyDown, ...props }, ref) => {
    const { orientation, triggerRefs, triggerValues, value, setValue } = useTabsContext();

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-surface-container-high p-1 text-on-surface-variant",
          className,
        )}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;

          const values = triggerValues.current;
          if (values.length === 0) return;
          const currentIndex = values.indexOf(value ?? values[0]);
          const nextHorizontal = event.key === "ArrowRight" || event.key === "ArrowDown";
          const prevHorizontal = event.key === "ArrowLeft" || event.key === "ArrowUp";
          const isForward = orientation === "vertical" ? event.key === "ArrowDown" : nextHorizontal;
          const isBackward = orientation === "vertical" ? event.key === "ArrowUp" : prevHorizontal;

          if (!isForward && !isBackward && event.key !== "Home" && event.key !== "End") {
            return;
          }

          event.preventDefault();
          let nextIndex = currentIndex >= 0 ? currentIndex : 0;
          if (event.key === "Home") {
            nextIndex = 0;
          } else if (event.key === "End") {
            nextIndex = values.length - 1;
          } else if (isForward) {
            nextIndex = (nextIndex + 1) % values.length;
          } else if (isBackward) {
            nextIndex = (nextIndex - 1 + values.length) % values.length;
          }

          const nextValue = values[nextIndex];
          const nextTrigger = triggerRefs.current[nextIndex];
          setValue(nextValue);
          nextTrigger?.focus();
        }}
        {...props}
      />
    );
  },
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value: triggerValue, onClick, children, disabled, ...props }, ref) => {
  const { value, setValue, triggerRefs, triggerValues } = useTabsContext();
  const indexRef = React.useRef<number>(-1);
  const isActive = value === triggerValue;

  React.useEffect(() => {
    const existingIndex = triggerValues.current.indexOf(triggerValue);
    const nextIndex = existingIndex >= 0 ? existingIndex : triggerValues.current.length;
    triggerValues.current[nextIndex] = triggerValue;
    indexRef.current = nextIndex;
    return () => {
      const currentIndex = triggerValues.current.indexOf(triggerValue);
      if (currentIndex >= 0) {
        triggerValues.current.splice(currentIndex, 1);
        triggerRefs.current.splice(currentIndex, 1);
      }
    };
  }, [triggerRefs, triggerValue, triggerValues]);

  return (
    <button
      ref={(node) => {
        const index = indexRef.current;
        if (index >= 0) {
          triggerRefs.current[index] = node;
        }
        assignRef(ref, node);
      }}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`${triggerValue}-content`}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-surface-container-lowest data-[state=active]:text-primary data-[state=active]:shadow-sm",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !disabled) {
          setValue(triggerValue);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value: contentValue, children, ...props }, ref) => {
  const { value } = useTabsContext();
  const active = value === contentValue;

  if (!active) {
    return null;
  }

  return (
    <div
      ref={ref}
      id={`${contentValue}-content`}
      role="tabpanel"
      tabIndex={0}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
