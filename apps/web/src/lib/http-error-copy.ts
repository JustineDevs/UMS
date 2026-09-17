export const HTTP_ERROR_CODES = [
  400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418,
  421, 422, 423, 424, 425, 426, 428, 429, 431, 451, 500, 501, 502, 503, 504, 505, 506, 507, 508,
  510, 511,
] as const;

export type HttpErrorCode = (typeof HTTP_ERROR_CODES)[number];

const COPY: Record<
  HttpErrorCode,
  { title: string; description: string }
> = {
  400: {
    title: "Bad request",
    description:
      "The request could not be understood. Check the address or try again from the shop.",
  },
  401: {
    title: "Sign in required",
    description:
      "You need to sign in to view this page or complete this action.",
  },
  402: {
    title: "Payment required",
    description: "Payment is required before this resource can be accessed.",
  },
  403: {
    title: "Access denied",
    description: "You do not have permission to view this page.",
  },
  404: {
    title: "Page not found",
    description: "This link may be broken or the page was removed.",
  },
  405: {
    title: "Method not allowed",
    description: "This action is not supported for the requested resource.",
  },
  406: {
    title: "Not acceptable",
    description: "The server cannot satisfy the requested format.",
  },
  408: {
    title: "Request timeout",
    description: "The request took too long. Try again in a moment.",
  },
  409: {
    title: "Conflict",
    description: "The request conflicts with the current state. Refresh and try again.",
  },
  410: {
    title: "Gone",
    description: "This page or resource is no longer available.",
  },
  411: {
    title: "Length required",
    description: "A valid content length is required for this request.",
  },
  412: {
    title: "Precondition failed",
    description: "One or more conditions were not met. Refresh and try again.",
  },
  413: {
    title: "Payload too large",
    description: "The upload or body is too large. Reduce size and try again.",
  },
  414: {
    title: "URI too long",
    description: "The address is too long. Use a shorter link or go back to the shop.",
  },
  415: {
    title: "Unsupported media type",
    description: "The file or content type is not supported.",
  },
  416: {
    title: "Range not satisfiable",
    description: "The requested range cannot be served.",
  },
  417: {
    title: "Expectation failed",
    description: "The server could not meet the requirements of the request headers.",
  },
  418: {
    title: "I am a teapot",
    description: "This server refuses to brew coffee in a teapot.",
  },
  421: {
    title: "Misdirected request",
    description: "The request was not sent to the correct endpoint.",
  },
  422: {
    title: "Unprocessable content",
    description: "The request was understood but could not be processed. Check your input.",
  },
  423: {
    title: "Locked",
    description: "This resource is locked and cannot be accessed right now.",
  },
  424: {
    title: "Failed dependency",
    description: "A related request failed, so this action could not complete.",
  },
  425: {
    title: "Too early",
    description: "The server is not ready to process this request yet.",
  },
  426: {
    title: "Upgrade required",
    description: "A protocol upgrade is required to access this resource.",
  },
  428: {
    title: "Precondition required",
    description: "The server requires conditional headers for this request.",
  },
  429: {
    title: "Too many requests",
    description: "Slow down and try again in a few moments.",
  },
  431: {
    title: "Request header fields too large",
    description: "Headers are too large. Clear cookies or try another browser.",
  },
  451: {
    title: "Unavailable for legal reasons",
    description: "This content is not available in your region or due to legal restrictions.",
  },
  500: {
    title: "Something went wrong",
    description: "We hit an unexpected error. Try again shortly.",
  },
  501: {
    title: "Not implemented",
    description: "This feature is not available on the server.",
  },
  502: {
    title: "Bad gateway",
    description: "An upstream service did not respond correctly. Try again soon.",
  },
  503: {
    title: "Service unavailable",
    description: "We are temporarily down for maintenance or load. Please try again.",
  },
  504: {
    title: "Gateway timeout",
    description: "A service took too long to respond. Try again.",
  },
  505: {
    title: "HTTP version not supported",
    description: "The server does not support this HTTP version.",
  },
  506: {
    title: "Variant also negotiates",
    description: "The server configuration prevents this content from being served.",
  },
  507: {
    title: "Insufficient storage",
    description: "The server cannot store the representation needed to complete the request.",
  },
  508: {
    title: "Loop detected",
    description: "The server detected an infinite loop while processing the request.",
  },
  510: {
    title: "Not extended",
    description: "Further extensions are required to fulfill this request.",
  },
  511: {
    title: "Network authentication required",
    description: "Network access requires authentication before you can continue.",
  },
};

export function isHttpErrorCode(n: number): n is HttpErrorCode {
  return (HTTP_ERROR_CODES as readonly number[]).includes(n);
}

export function getHttpErrorCopy(code: number): { title: string; description: string } | null {
  if (!isHttpErrorCode(code)) return null;
  return COPY[code];
}
