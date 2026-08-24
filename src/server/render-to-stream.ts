import type { Provides } from "../component/provide";
import { hasOwn, isPlainObject } from "./render-shared";
import type { RenderToStringAsyncSource } from "./render-to-string";

export interface RenderToStreamOptions {
  context?: Record<string, unknown>;
  provides?: Provides;
}

export function renderToStream(
  source: RenderToStringAsyncSource,
  options: RenderToStreamOptions = {},
): ReadableStream<Uint8Array> {
  assertStreamOptions(options);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamSource(source, options.provides ?? null)) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function* streamSource(
  source: RenderToStringAsyncSource,
  appProvides: Provides | null,
): AsyncGenerator<string> {
  void source;
  void appProvides;
  yield "";
}

function assertStreamOptions(options: RenderToStreamOptions): void {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("SSR streaming options must be an object");
  }

  if (options.context !== undefined && !isPlainObject(options.context)) {
    throw new TypeError("SSR context must be a plain object");
  }

  if (options.provides !== undefined && !(options.provides instanceof Map)) {
    throw new TypeError("SSR provides must be a Map");
  }

  if (hasOwn(options, "manifest") || hasOwn(options, "clientEntry")) {
    throw new TypeError(
      "SSR manifest integration is deferred; compose assets in an app-local shell or adapter.",
    );
  }

  if (hasOwn(options, "router")) {
    throw new TypeError(
      "Router-aware SSR integration is deferred; pass explicit render sources instead.",
    );
  }

  const unknownKey = Reflect.ownKeys(options).find(
    (key) => key !== "context" && key !== "provides",
  );
  if (unknownKey !== undefined) {
    throw new TypeError(`Unknown SSR streaming option: ${String(unknownKey)}`);
  }
}
