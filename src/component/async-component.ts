import { getCurrentInstance } from "./lifecycle";
import { h } from "../vnode/h";
import { Fragment, type ComponentType, type VNode, type VNodeChildren } from "../vnode/vnode";

export type AsyncComponentLoader<Props extends object> = () => Promise<ComponentType<Props>>;

export interface AsyncComponentOptions<Props extends object> {
  loader: AsyncComponentLoader<Props>;
  loadingComponent?: ComponentType<Props>;
  errorComponent?: ComponentType<Props>;
  delay?: number;
  timeout?: number;
  retry?: number;
  retryDelay?: number;
  fallback?: VNode | (() => VNode);
}

export type AsyncComponentSource<Props extends object> =
  AsyncComponentLoader<Props> | AsyncComponentOptions<Props>;

export interface AsyncComponentMetadata {
  load(): Promise<ComponentType<never>>;
  peek(): ComponentType<never> | null;
  getFallback(): VNode | null;
}

const asyncComponentMetadata = new WeakMap<object, AsyncComponentMetadata>();

export function getAsyncComponentMetadata(component: unknown): AsyncComponentMetadata | undefined {
  return typeof component === "function" ? asyncComponentMetadata.get(component) : undefined;
}

export function defineAsyncComponent<Props extends object>(
  source: AsyncComponentSource<Props>,
): ComponentType<Props> {
  const options = normalizeAsyncComponentOptions(source);
  let resolvedComponent: ComponentType<Props> | null = null;
  let pendingRequest: Promise<void> | null = null;
  let loadError: unknown = null;
  let isLoadingVisible = getDelay(options) <= 0;
  let failedAttempts = 0;
  let activeAttemptId = 0;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let preparationRequest: Promise<ComponentType<Props>> | null = null;

  const component: ComponentType<Props> = (props, { slots }) => {
    const instance = getCurrentInstance();
    const update = instance?.update ?? null;

    return () => {
      const children = normalizeSlotChildren(slots.default?.());

      if (resolvedComponent !== null) {
        return renderComponent(resolvedComponent, props, children);
      }

      if (loadError !== null) {
        return options.errorComponent
          ? renderComponent(options.errorComponent, props, children)
          : h(Fragment, null, []);
      }

      if (pendingRequest === null && retryTimer === null && loadError === null) {
        startLoad(update);
      }

      return options.loadingComponent && isLoadingVisible
        ? renderComponent(options.loadingComponent, props, children)
        : h(Fragment, null, []);
    };
  };

  asyncComponentMetadata.set(component, {
    load: loadForPreparation as () => Promise<ComponentType<never>>,
    peek: () => resolvedComponent as ComponentType<never> | null,
    getFallback: () => {
      const fallback = options.fallback;
      if (fallback === undefined) return null;
      return typeof fallback === "function" ? fallback() : fallback;
    },
  });

  return component;

  function loadForPreparation(): Promise<ComponentType<Props>> {
    if (resolvedComponent !== null) {
      return Promise.resolve(resolvedComponent);
    }

    if (preparationRequest !== null) {
      return preparationRequest;
    }

    preparationRequest = loadWithRetry().finally(() => {
      preparationRequest = null;
    });
    return preparationRequest;
  }

  async function loadWithRetry(): Promise<ComponentType<Props>> {
    let failures = 0;

    while (true) {
      try {
        const loaded = await loadPreparationAttempt();
        if (typeof loaded !== "function") {
          throw new TypeError("Async component loader must resolve to a component function");
        }

        resolvedComponent = loaded;
        loadError = null;
        clearAsyncTimers();
        return loaded;
      } catch (error) {
        failures += 1;
        if (failures > getRetry(options)) {
          throw error;
        }

        const retryDelay = getRetryDelay(options);
        if (retryDelay > 0) {
          await wait(retryDelay);
        }
      }
    }
  }

  function loadPreparationAttempt(): Promise<ComponentType<Props>> {
    const request = options.loader();
    if (options.timeout === undefined) {
      return request;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Async component timed out")),
        options.timeout,
      );
      request.then(
        (loaded) => {
          clearTimeout(timer);
          resolve(loaded);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  function startLoad(update: (() => void) | null): void {
    const attemptId = activeAttemptId + 1;
    activeAttemptId = attemptId;

    clearAttemptTimers();
    startDelayTimer(options, () => {
      if (attemptId !== activeAttemptId) {
        return;
      }

      isLoadingVisible = true;
      update?.();
    });
    startTimeoutTimer(options, () => {
      handleLoadFailure(new Error("Async component timed out"), attemptId, update);
    });

    pendingRequest = options
      .loader()
      .then((component) => {
        if (attemptId !== activeAttemptId || loadError !== null) {
          return;
        }

        clearAsyncTimers();
        pendingRequest = null;
        resolvedComponent = component;
        update?.();
      })
      .catch((error: unknown) => {
        handleLoadFailure(error, attemptId, update);
      });
  }

  function handleLoadFailure(error: unknown, attemptId: number, update: (() => void) | null): void {
    if (attemptId !== activeAttemptId || resolvedComponent !== null || loadError !== null) {
      return;
    }

    clearAttemptTimers();
    pendingRequest = null;
    failedAttempts += 1;

    if (failedAttempts <= getRetry(options)) {
      const retryDelay = getRetryDelay(options);

      if (retryDelay <= 0) {
        startLoad(update);
        return;
      }

      retryTimer = setTimeout(() => {
        retryTimer = null;
        startLoad(update);
      }, retryDelay);
      return;
    }

    loadError = error;
    update?.();
  }

  function startDelayTimer(
    currentOptions: AsyncComponentOptions<Props>,
    onDelay: () => void,
  ): void {
    const delay = getDelay(currentOptions);

    if (delay <= 0) {
      isLoadingVisible = true;
      return;
    }

    isLoadingVisible = false;
    delayTimer = setTimeout(onDelay, delay);
  }

  function startTimeoutTimer(
    currentOptions: AsyncComponentOptions<Props>,
    onTimeout: () => void,
  ): void {
    if (currentOptions.timeout === undefined) {
      return;
    }

    timeoutTimer = setTimeout(onTimeout, currentOptions.timeout);
  }

  function clearAsyncTimers(): void {
    clearAttemptTimers();

    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function clearAttemptTimers(): void {
    if (delayTimer !== null) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }

    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  }
}

function normalizeAsyncComponentOptions<Props extends object>(
  source: AsyncComponentSource<Props>,
): AsyncComponentOptions<Props> {
  return typeof source === "function" ? { loader: source } : source;
}

function renderComponent<Props extends object>(
  component: ComponentType<Props>,
  props: Props,
  children: VNodeChildren,
) {
  return h(component, props, children);
}

function normalizeSlotChildren(children: VNodeChildren | undefined): VNodeChildren {
  return children ?? null;
}

function getDelay<Props extends object>(options: AsyncComponentOptions<Props>): number {
  return options.delay ?? 0;
}

function getRetry<Props extends object>(options: AsyncComponentOptions<Props>): number {
  return options.retry ?? 0;
}

function getRetryDelay<Props extends object>(options: AsyncComponentOptions<Props>): number {
  return options.retryDelay ?? 0;
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}
