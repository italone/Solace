import { getCurrentInstance } from "./lifecycle";
import { h } from "../vnode/h";
import { Fragment, type ComponentType, type VNodeChildren } from "../vnode/vnode";

export type AsyncComponentLoader<Props extends object> = () => Promise<ComponentType<Props>>;

export interface AsyncComponentOptions<Props extends object> {
  loader: AsyncComponentLoader<Props>;
  loadingComponent?: ComponentType<Props>;
  errorComponent?: ComponentType<Props>;
  delay?: number;
  timeout?: number;
  retry?: number;
  retryDelay?: number;
}

export type AsyncComponentSource<Props extends object> =
  AsyncComponentLoader<Props> | AsyncComponentOptions<Props>;

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

  return (props, { slots }) => {
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
