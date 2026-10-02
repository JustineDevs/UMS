import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used within <Dialog />");
  }
  return context;
}

type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

const Dialog = ({ open, defaultOpen, onOpenChange, children }: DialogProps) => {
  const [internalOpen, setInternalOpen] = React.useState(Boolean(defaultOpen));
  const titleId = React.useId();
  const descriptionId = React.useId();

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

  const value = React.useMemo(
    () => ({ open: currentOpen, setOpen, titleId, descriptionId }),
    [currentOpen, setOpen, titleId, descriptionId],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};
Dialog.displayName = "Dialog";

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
};

const composeHandlers =
  <E,>(first?: (event: E) => void, second?: (event: E) => void) =>
  (event: E) => {
    first?.(event);
    second?.(event);
  };

const DialogTrigger = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild = false, onClick, children, type = "button", ...props }, ref) => {
    const { open, setOpen } = useDialogContext();
    const handleClick = composeHandlers(onClick, () => setOpen(!open));

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        onClick: handleClick,
      } as React.HTMLAttributes<HTMLElement>);
    }

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DialogTrigger.displayName = "DialogTrigger";

const DialogClose = React.forwardRef<HTMLButtonElement, TriggerProps>(
  ({ asChild = false, onClick, children, type = "button", ...props }, ref) => {
    const { setOpen } = useDialogContext();
    const handleClick = composeHandlers(onClick, () => setOpen(false));

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        onClick: handleClick,
      } as React.HTMLAttributes<HTMLElement>);
    }

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DialogClose.displayName = "DialogClose";

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
};
DialogPortal.displayName = "DialogPortal";

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = useDialogContext();
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, titleId, descriptionId } = useDialogContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  const setContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [ref],
  );

  React.useEffect(() => {
    if (!open || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusDialog = () => contentRef.current?.focus();
    const frame = window.requestAnimationFrame(focusDialog);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !contentRef.current) {
        return;
      }

      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, setOpen]);

  if (!open) {
    return null;
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={setContentRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-lg sm:w-full sm:rounded-lg sm:p-6",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  const { titleId } = useDialogContext();
  return (
    <h2
      ref={ref}
      id={titleId}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-primary",
        className,
      )}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descriptionId } = useDialogContext();
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn("text-sm text-on-surface-variant", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  useDialogContext,
};
