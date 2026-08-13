"use client";
import posthog from "posthog-js";
import { getPostHogHost, getPostHogProjectToken } from "./env/posthog.js";
const POSTHOG_DEFAULTS = "2026-05-30";
const POSTHOG_SESSION_RECORDING = {
    maskAllInputs: false,
    maskTextSelector: "[data-ph-mask]",
};
let initializedToken;
let initializedHost;
function isBrowser() {
    return typeof globalThis !== "undefined" && "window" in globalThis;
}
function resolveTracingHeaders(tracingHeaders) {
    if (!tracingHeaders || tracingHeaders.length === 0) {
        return undefined;
    }
    return tracingHeaders;
}
export function ensurePostHogClient(options) {
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
    posthog.init(token, {
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
export function identifyPostHogClient(distinctId, properties) {
    if (!ensurePostHogClient()) {
        return false;
    }
    posthog.identify(distinctId, properties);
    return true;
}
export function resetPostHogClient() {
    if (!isBrowser() || !initializedToken) {
        return false;
    }
    posthog.reset();
    initializedToken = undefined;
    initializedHost = undefined;
    return true;
}
export function capturePostHogClientEvent(event, properties) {
    if (!ensurePostHogClient()) {
        return false;
    }
    posthog.capture(event, properties);
    return true;
}
export function capturePostHogClientException(error, properties) {
    if (!ensurePostHogClient()) {
        return false;
    }
    posthog.captureException(error, properties);
    return true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGhvZy1jbGllbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJwb3N0aG9nLWNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixPQUFPLE9BQU8sTUFBTSxZQUFZLENBQUM7QUFDakMsT0FBTyxFQUFFLGNBQWMsRUFBRSxzQkFBc0IsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBSTFFLE1BQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDO0FBQ3RDLE1BQU0seUJBQXlCLEdBQUc7SUFDaEMsYUFBYSxFQUFFLEtBQUs7SUFDcEIsZ0JBQWdCLEVBQUUsZ0JBQWdCO0NBQzFCLENBQUM7QUFFWCxJQUFJLGdCQUFvQyxDQUFDO0FBQ3pDLElBQUksZUFBbUMsQ0FBQztBQUV4QyxTQUFTLFNBQVM7SUFDaEIsT0FBTyxPQUFPLFVBQVUsS0FBSyxXQUFXLElBQUksUUFBUSxJQUFJLFVBQVUsQ0FBQztBQUNyRSxDQUFDO0FBRUQsU0FBUyxxQkFBcUIsQ0FBQyxjQUF5QjtJQUN0RCxJQUFJLENBQUMsY0FBYyxJQUFJLGNBQWMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDbkQsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUNELE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRCxNQUFNLFVBQVUsbUJBQW1CLENBQUMsT0FFbkM7SUFDQyxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQztRQUNqQixPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRCxNQUFNLEtBQUssR0FBRyxzQkFBc0IsRUFBRSxDQUFDO0lBQ3ZDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNYLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELE1BQU0sSUFBSSxHQUFHLGNBQWMsRUFBRSxDQUFDO0lBQzlCLElBQUksZ0JBQWdCLEtBQUssS0FBSyxJQUFJLGVBQWUsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUMzRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRTtRQUNsQixRQUFRLEVBQUUsSUFBSTtRQUNkLFFBQVEsRUFBRSxnQkFBZ0I7UUFDMUIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixpQkFBaUIsRUFBRSxJQUFJO1FBQ3ZCLFdBQVcsRUFBRSxJQUFJO1FBQ2pCLGVBQWUsRUFBRSxxQkFBcUIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDO1FBQy9ELGlCQUFpQixFQUFFLHlCQUF5QjtLQUM3QyxDQUFDLENBQUM7SUFFSCxnQkFBZ0IsR0FBRyxLQUFLLENBQUM7SUFDekIsZUFBZSxHQUFHLElBQUksQ0FBQztJQUN2QixPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUscUJBQXFCLENBQ25DLFVBQWtCLEVBQ2xCLFVBQW9DO0lBRXBDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7UUFDM0IsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDekMsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsTUFBTSxVQUFVLGtCQUFrQjtJQUNoQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3RDLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNELE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNoQixnQkFBZ0IsR0FBRyxTQUFTLENBQUM7SUFDN0IsZUFBZSxHQUFHLFNBQVMsQ0FBQztJQUM1QixPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUseUJBQXlCLENBQ3ZDLEtBQWEsRUFDYixVQUFvQztJQUVwQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxDQUFDO1FBQzNCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNELE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25DLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELE1BQU0sVUFBVSw2QkFBNkIsQ0FDM0MsS0FBWSxFQUNaLFVBQW9DO0lBRXBDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUM7UUFDM0IsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ0QsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxVQUFVLENBQUMsQ0FBQztJQUM1QyxPQUFPLElBQUksQ0FBQztBQUNkLENBQUMifQ==