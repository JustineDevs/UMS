"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export const CardAction = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)} {...props} />
);

export const Avatar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="avatar" className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full bg-muted", className)} {...props} />
);
export const AvatarImage = ({ className, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img data-slot="avatar-image" className={cn("aspect-square size-full object-cover", className)} {...props} />
);
export const AvatarFallback = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="avatar-fallback" className={cn("flex size-full items-center justify-center text-sm text-muted-foreground", className)} {...props} />
);
export const AvatarBadge = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span data-slot="avatar-badge" className={cn("absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background bg-green-500", className)} {...props} />
);

export const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} type="checkbox" className={cn("size-4 rounded border-input accent-primary", className)} {...props} />,
);
Checkbox.displayName = "Checkbox";

export function Pagination({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <nav aria-label="pagination" className={cn("flex items-center gap-1.5", className)} {...props}>{children}</nav>;
}
export const PaginationContent = ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => <ul className={cn("flex items-center gap-1.5", className)} {...props} />;
export const PaginationItem = ({ className, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => <li className={className} {...props} />;
export const PaginationLink = ({ active, className, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) => <a aria-current={active ? "page" : undefined} className={cn("inline-flex size-8 items-center justify-center rounded-lg text-sm hover:bg-muted", active && "border bg-background", className)} {...props} />;
export const PaginationPrevious = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <PaginationLink aria-label="Go to previous page" {...props}>Previous</PaginationLink>;
export const PaginationNext = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <PaginationLink aria-label="Go to next page" {...props}>Next</PaginationLink>;
export const PaginationEllipsis = () => <span aria-hidden="true" className="inline-flex size-8 items-center justify-center text-muted-foreground">...</span>;

export function ToggleGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="radiogroup" className={cn("inline-flex items-center gap-1 rounded-lg bg-muted p-1", className)} {...props}>{children}</div>;
}
export const ToggleGroupItem = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={cn("rounded-md px-2.5 py-1 text-sm hover:bg-background", className)} {...props} />;

export function InputGroup({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 items-center rounded-lg border bg-background", className)} {...props}>{children}</div>;
}
export const InputGroupInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} data-slot="input-group-control" className={cn("min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none", className)} {...props} />);
InputGroupInput.displayName = "InputGroupInput";
export const InputGroupTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} data-slot="input-group-control" className={cn("min-w-0 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none", className)} {...props} />);
InputGroupTextarea.displayName = "InputGroupTextarea";
export const InputGroupAddon = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-center gap-1 p-1.5", className)} {...props} />;
export const InputGroupButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={cn("inline-flex size-7 items-center justify-center rounded-md text-sm hover:bg-muted", className)} {...props} />;

export const Progress = ({ value = 0, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: number }) => <div role="progressbar" aria-valuenow={value} className={cn("h-2 overflow-hidden rounded-full bg-muted", className)} {...props}><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
export const Empty = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground", className)} {...props}>{children ?? "Nothing to display"}</div>;
export const EmptyTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("font-medium text-foreground", className)} {...props} />;
export const EmptyDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={className} {...props} />;

export const MessageGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="message-group" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
export const Message = ({ align = "start", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) => <div data-slot="message" data-align={align} className={cn("flex w-full min-w-0 gap-2 text-sm", align === "end" && "flex-row-reverse", className)} {...props} />;
export const MessageAvatar = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="message-avatar" className={cn("flex w-fit shrink-0 items-center self-end overflow-hidden rounded-full bg-muted", className)} {...props} />;
export const MessageContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="message-content" className={cn("flex min-w-0 flex-1 flex-col gap-2", className)} {...props} />;
export const MessageFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="message-footer" className={cn("px-3 text-xs text-muted-foreground", className)} {...props} />;
export const MessageHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="message-header" className={cn("px-3 text-xs font-medium text-muted-foreground", className)} {...props} />;

export const BubbleGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
export const Bubble = ({ variant = "default", align = "start", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "muted" | "outline" | "destructive"; align?: "start" | "end" }) => <div data-slot="bubble" data-variant={variant} className={cn("flex w-fit max-w-[80%] flex-col gap-1", align === "end" && "self-end", className)} {...props} />;
export const BubbleContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="bubble-content" className={cn("rounded-xl border px-3 py-2 leading-relaxed", className)} {...props} />;
export const BubbleReactions = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="bubble-reactions" className={cn("w-fit rounded-full bg-muted px-1.5 py-0.5 text-xs", className)} {...props} />;

export const Attachment = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="attachment" className={cn("flex w-fit items-center gap-2 rounded-xl border bg-card p-2 text-sm", className)} {...props} />;
export const AttachmentGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex gap-3 overflow-x-auto", className)} {...props} />;
export const AttachmentMedia = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="attachment-media" className={cn("flex size-10 items-center justify-center rounded-lg bg-muted", className)} {...props} />;
export const AttachmentContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="attachment-content" className={cn("min-w-0 flex-1", className)} {...props} />;
export const AttachmentTitle = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span className={cn("block truncate font-medium", className)} {...props} />;
export const AttachmentDescription = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span className={cn("block truncate text-xs text-muted-foreground", className)} {...props} />;
export const AttachmentActions = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex items-center", className)} {...props} />;
export const AttachmentAction = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={cn("size-7 rounded-md hover:bg-muted", className)} {...props} />;
export const AttachmentTrigger = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={cn("absolute inset-0", className)} {...props} />;

export const MessageScrollerProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const MessageScroller = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex min-h-0 flex-col overflow-hidden", className)} {...props} />;
export const MessageScrollerViewport = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("min-h-0 flex-1 overflow-y-auto", className)} {...props} />;
export const MessageScrollerContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex min-h-full flex-col gap-6 p-4", className)} {...props} />;
export const MessageScrollerItem = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={className} {...props} />;
export const MessageScrollerButton = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" className={cn("rounded-full border bg-background px-3 py-1 text-xs shadow", className)} {...props}>Jump to latest</button>;

export const ChartContainer = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-slot="chart" className={cn("flex min-h-0 w-full justify-center text-xs", className)} {...props}>{children}</div>;
export const ChartTooltip = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const ChartLegend = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const Tooltip = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const TooltipTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const TooltipContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div role="tooltip" className={cn("rounded-md border bg-background px-2 py-1 text-xs shadow", className)} {...props}>{children}</div>;
export const Popover = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const PopoverTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const PopoverContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-lg border bg-background p-4 shadow-lg", className)} {...props} />;
export const HoverCard = Popover;
export const HoverCardTrigger = PopoverTrigger;
export const HoverCardContent = PopoverContent;
export const ButtonGroup = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div role="group" className={cn("flex items-center gap-1", className)} {...props} />;
export const Drawer = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const DrawerContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("rounded-t-xl border bg-background p-4 shadow-lg", className)} {...props} />;
export const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("flex flex-col gap-1", className)} {...props} />;
export const DrawerTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn("font-medium", className)} {...props} />;
export const DrawerDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p className={cn("text-sm text-muted-foreground", className)} {...props} />;

export function Calendar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="application" aria-label="Calendar" className={cn("grid grid-cols-7 gap-1 text-center text-sm", className)} {...props} />;
}

export function Combobox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input role="combobox" className={cn("h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring", className)} {...props} />;
}
