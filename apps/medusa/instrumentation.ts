/**
 * OpenTelemetry instrumentation for observability.
 * Set OTEL_ENABLED=true to activate. Traces are exported to the
 * configured OTLP or Zipkin endpoint (default: local Zipkin fallback).
 *
 * Docs: https://docs.medusajs.com/learn/debugging-and-testing/instrumentation
 */

const otelEnabled = process.env.OTEL_ENABLED?.trim().toLowerCase() === "true";

function parseOtelHeaders(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  return raw.split(",").reduce<Record<string, string>>((acc, pair) => {
    const [key, ...valueParts] = pair.split("=");
    const name = key?.trim();
    const value = valueParts.join("=").trim();
    if (name && value) {
      acc[name] = value;
    }
    return acc;
  }, {});
}

export async function register() {
  if (!otelEnabled) return;

  const { registerOtel } = await import("@medusajs/medusa");

  let exporter: unknown = undefined;
  try {
    const otlpEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
    if (otlpEndpoint) {
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      exporter = new OTLPTraceExporter({
        url: otlpEndpoint,
        headers: parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      });
    } else {
      const zipkinUrl =
        process.env.OTEL_EXPORTER_ZIPKIN_URL?.trim() ||
        "http://localhost:9411/api/v2/spans";
      const { ZipkinExporter } = await import(
        "@opentelemetry/exporter-zipkin"
      );
      exporter = new ZipkinExporter({
        serviceName: "universal-music-store-medusa",
        url: zipkinUrl,
      });
    }
  } catch {
    console.warn("[otel] OTLP/Zipkin exporter not installed. Using default console exporter.");
  }

  registerOtel({
    serviceName: "universal-music-store-medusa",
    ...(exporter ? { exporter: exporter as never } : {}),
    instrument: {
      http: true,
      workflows: true,
      query: true,
    },
  });
}
