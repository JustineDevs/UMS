"use client";

import posthog from "posthog-js";
import { getPostHogHost, getPostHogProjectToken } from "./env/posthog.js";

type PostHogPersonProperties = Record<string, unknown>;

type PostHogClient = {
  init: (token: string, config: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: PostHogPersonProperties) => void;
  reset: () => void;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  captureException: (error: Error, properties?: Record<string, unknown>) => void;
};

const posthogClient = posthog as unknown as PostHogClient;

const POSTHOG_DEFAULTS = "2026-05-30";
const POSTHOG_SESSION_RECORDING = {
  maskAllInputs: false,
  maskTextSelector: "[data-ph-mask]",
} as const;

let initializedToken: string | undefined;
let initializedHost: string | undefined;

function isBrowser(): boolean {
  return typeof globalThis !== "undefined" && "window" in globalThis;
}

function resolveTracingHeaders(tracingHeaders?: string[]): string[] | undefined {
  if (!tracingHeaders || tracingHeaders.length === 0) {
    return undefined;
  }
  return tracingHeaders;
}

export function ensurePostHogClient(options?: {
  tracingHeaders?: string[];
}): boolean {
  if (!isBrowser()) {
    return false;
  }

  const token = getPostHogProjectToken();
  if (!token) {
    return false;
  }

  const host = getPostHogHost();
  if (initializedToken === token && initializedHost === host) {
    return true;
  }

  posthogClient.init(token, {
    api_host: host,
    defaults: POSTHOG_DEFAULTS,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    tracing_headers: resolveTracingHeaders(options?.tracingHeaders),
    session_recording: POSTHOG_SESSION_RECORDING,
  });

  initializedToken = token;
  initializedHost = host;
  return true;
}

export function identifyPostHogClient(
  distinctId: string,
  properties?: PostHogPersonProperties,
): boolean {
  if (!ensurePostHogClient()) {
    return false;
  }
  posthogClient.identify(distinctId, properties);
  return true;
}

export function resetPostHogClient(): boolean {
  if (!isBrowser() || !initializedToken) {
    return false;
  }
  posthogClient.reset();
  initializedToken = undefined;
  initializedHost = undefined;
  return true;
}

export function capturePostHogClientEvent(
  event: string,
  properties?: Record<string, unknown>,
): boolean {
  if (!ensurePostHogClient()) {
    return false;
  }
  posthogClient.capture(event, properties);
  return true;
}

export function capturePostHogClientException(
  error: Error,
  properties?: Record<string, unknown>,
): boolean {
  if (!ensurePostHogClient()) {
    return false;
  }
  posthogClient.captureException(error, properties);
  return true;
}
