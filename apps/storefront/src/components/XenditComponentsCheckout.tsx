"use client";

import { useEffect, useRef, useState } from "react";
import { XenditComponents } from "xendit-components-web";

export function XenditComponentsCheckout({
  componentsSdkKey,
  onComplete,
  onError,
}: {
  componentsSdkKey: string;
  onComplete: () => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<XenditComponents | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeChannels, setActiveChannels] = useState<string[]>([]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !componentsSdkKey) return;

    const components = new XenditComponents({ componentsSdkKey });
    const picker = components.createChannelPickerComponent();
    container.replaceChildren(picker);
    componentsRef.current = components;

    const handleReady = () => {
      setReady(true);
      setActiveChannels(
        components
          .getActiveChannels()
          .flatMap((channel) => Array.isArray(channel.channelCode) ? channel.channelCode : [channel.channelCode])
          .filter(Boolean),
      );
    };
    const handleBegin = () => setSubmitting(true);
    const handleEnd = () => setSubmitting(false);
    const handleNotReady = () => setReady(false);
    const handleComplete = () => {
      setSubmitting(false);
      onCompleteRef.current();
    };
    const handleCanceled = () => {
      setSubmitting(false);
      onErrorRef.current("Xendit payment was canceled or expired. Choose a payment method and try again.");
    };

    components.addEventListener("submission-ready", handleReady);
    components.addEventListener("submission-not-ready", handleNotReady);
    components.addEventListener("submission-begin", handleBegin);
    components.addEventListener("submission-end", handleEnd);
    components.addEventListener("session-complete", handleComplete);
    components.addEventListener("session-expired-or-canceled", handleCanceled);

    return () => {
      components.removeEventListener("submission-ready", handleReady);
      components.removeEventListener("submission-not-ready", handleNotReady);
      components.removeEventListener("submission-begin", handleBegin);
      components.removeEventListener("submission-end", handleEnd);
      components.removeEventListener("session-complete", handleComplete);
      components.removeEventListener("session-expired-or-canceled", handleCanceled);
      componentsRef.current = null;
      container.replaceChildren();
    };
  }, [componentsSdkKey]);

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="min-h-24" aria-label="Xendit payment methods" />
      {activeChannels.length > 0 ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Available methods: {activeChannels.join(", ")}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          try {
            componentsRef.current?.submit();
          } catch (error) {
            onErrorRef.current(
              error instanceof Error
                ? error.message
                : "Select a valid Xendit payment method.",
            );
          }
        }}
        disabled={!ready || submitting}
        className="w-full rounded border border-primary bg-primary px-4 py-3 text-sm font-bold uppercase tracking-widest text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Processing payment..." : "Pay with Xendit"}
      </button>
    </div>
  );
}
