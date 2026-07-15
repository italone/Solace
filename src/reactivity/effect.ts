import { emitDevtoolsEvent, hasDevtoolsListeners, type DevtoolsEvent } from "../devtools/events";

type Dep = Set<ReactiveEffect>;
type Scheduler = () => void;

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>();
let activeEffect: ReactiveEffect | undefined;

export class ReactiveEffect<T = unknown> {
  public active = true;
  public readonly deps: Dep[] = [];

  public constructor(
    public readonly fn: () => T,
    public readonly scheduler?: Scheduler,
  ) {}

  public run(): T {
    if (!this.active) {
      return this.fn();
    }

    return runEffect(this);
  }

  public stop(): void {
    if (!this.active) {
      return;
    }

    cleanupEffect(this);
    this.active = false;
  }
}

function runEffect<T>(reactiveEffect: ReactiveEffect<T>): T {
  const parentEffect = activeEffect;
  cleanupEffect(reactiveEffect);
  activeEffect = reactiveEffect;
  try {
    return reactiveEffect.fn();
  } finally {
    activeEffect = parentEffect;
  }
}

function cleanupEffect(reactiveEffect: ReactiveEffect): void {
  reactiveEffect.deps.forEach((dep) => {
    dep.delete(reactiveEffect);
  });
  reactiveEffect.deps.length = 0;
}

export function effect<T>(fn: () => T): () => T {
  const reactiveEffect = new ReactiveEffect(fn);

  reactiveEffect.run();

  return reactiveEffect.run.bind(reactiveEffect);
}

export function track(target: object, key: PropertyKey): void {
  if (activeEffect === undefined) {
    return;
  }

  let depsMap = targetMap.get(target);
  if (depsMap === undefined) {
    depsMap = new Map<PropertyKey, Dep>();
    targetMap.set(target, depsMap);
  }

  let dep = depsMap.get(key);
  if (dep === undefined) {
    dep = new Set<ReactiveEffect>();
    depsMap.set(key, dep);
  }

  if (dep.has(activeEffect)) {
    return;
  }

  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

export function trigger(target: object, key: PropertyKey): void {
  const dep = targetMap.get(target)?.get(key);
  if (dep === undefined) {
    return;
  }

  const effects = new Set(dep);
  let scheduledEffects = 0;
  let runEffects = 0;

  effects.forEach((reactiveEffect) => {
    if (!reactiveEffect.active) {
      return;
    }

    if (reactiveEffect.scheduler !== undefined) {
      scheduledEffects += 1;
      reactiveEffect.scheduler();
      return;
    }

    runEffects += 1;
    reactiveEffect.run();
  });

  emitReactivityTriggerDevtoolsEvent(target, key, scheduledEffects, runEffects);
}

function emitReactivityTriggerDevtoolsEvent(
  target: object,
  key: PropertyKey,
  scheduledEffects: number,
  runEffects: number,
): void {
  if (!hasDevtoolsListeners()) {
    return;
  }

  emitDevtoolsEvent({
    type: "reactivity:trigger",
    targetType: getDevtoolsTargetType(target),
    keyType: typeof key,
    effectCount: scheduledEffects + runEffects,
    scheduledEffects,
    runEffects,
  });
}

function getDevtoolsTargetType(
  target: object,
): Extract<DevtoolsEvent, { type: "reactivity:trigger" }>["targetType"] {
  if (Array.isArray(target)) {
    return "array";
  }

  return typeof target;
}
