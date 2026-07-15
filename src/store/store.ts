import { emitDevtoolsEvent, hasDevtoolsListeners, type DevtoolsEvent } from "../devtools/events";
import { computed, type ComputedRef } from "../reactivity/computed";
import { reactive } from "../reactivity/reactive";

type StateFactory<State extends object> = () => State;
type ActionTree<State extends object, GetterValues extends Record<string, unknown>> = Record<
  string,
  (context: StoreContext<State, GetterValues>, ...args: never[]) => unknown
>;

export interface StoreGetterContext<State extends object> {
  state: State;
}

export type StoreGetters<State extends object, GetterValues extends Record<string, unknown>> = {
  [Key in keyof GetterValues]: (context: StoreGetterContext<State>) => GetterValues[Key];
};

export type StoreActionsInput<
  State extends object,
  GetterValues extends Record<string, unknown>,
> = ActionTree<State, GetterValues>;

type StoreActionMethods<Actions> = {
  [Key in keyof Actions]: Actions[Key] extends (context: never, ...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : never;
};

export interface StoreContext<
  State extends object,
  GetterValues extends Record<string, unknown> = Record<string, never>,
> {
  state: State;
  getters: Readonly<GetterValues>;
}

export interface Store<
  State extends object,
  GetterValues extends Record<string, unknown> = Record<string, never>,
  Actions extends ActionTree<State, GetterValues> = Record<string, never>,
> extends StoreContext<State, GetterValues> {
  actions: StoreActionMethods<Actions>;
}

export interface StoreOptions<
  State extends object,
  GetterValues extends Record<string, unknown> = Record<string, never>,
  Actions extends ActionTree<State, GetterValues> = Record<string, never>,
> {
  state: StateFactory<State>;
  getters?: StoreGetters<State, GetterValues>;
  actions?: Actions & StoreActionsInput<State, GetterValues>;
}

export function createStore<State extends object>(options: {
  state: StateFactory<State>;
}): Store<State>;
export function createStore<
  State extends object,
  GetterValues extends Record<string, unknown>,
>(options: {
  state: StateFactory<State>;
  getters: StoreGetters<State, GetterValues>;
}): Store<State, GetterValues>;
export function createStore<
  State extends object,
  Actions extends ActionTree<State, Record<string, never>>,
>(options: {
  state: StateFactory<State>;
  actions: Actions & StoreActionsInput<State, Record<string, never>>;
}): Store<State, Record<string, never>, Actions>;
export function createStore<
  State extends object,
  GetterValues extends Record<string, unknown>,
  Actions extends ActionTree<State, GetterValues>,
>(options: {
  state: StateFactory<State>;
  getters: StoreGetters<State, GetterValues>;
  actions: Actions & StoreActionsInput<State, GetterValues>;
}): Store<State, GetterValues, Actions>;
export function createStore<
  State extends object,
  GetterValues extends Record<string, unknown> = Record<string, never>,
  Actions extends ActionTree<State, GetterValues> = Record<string, never>,
>(options: StoreOptions<State, GetterValues, Actions>): Store<State, GetterValues, Actions> {
  const state = reactive(options.state());
  const getterRefs: Partial<Record<keyof GetterValues, ComputedRef<unknown>>> = {};
  const getters = {} as GetterValues;
  const context: StoreContext<State, GetterValues> = {
    state,
    getters,
  };
  const actions = {} as StoreActionMethods<Actions>;

  for (const [key, getter] of Object.entries(options.getters ?? {}) as Array<
    [keyof GetterValues, StoreGetters<State, GetterValues>[keyof GetterValues]]
  >) {
    getterRefs[key] = computed(() => getter({ state }));
    Object.defineProperty(getters, key, {
      enumerable: true,
      get: () => getterRefs[key]?.value,
    });
  }

  for (const [key, action] of Object.entries(options.actions ?? {}) as Array<
    [keyof Actions, Actions[keyof Actions]]
  >) {
    const runAction = action as unknown as (
      context: StoreContext<State, GetterValues>,
      ...args: unknown[]
    ) => unknown;
    actions[key] = ((...args: unknown[]) => {
      if (!hasDevtoolsListeners()) {
        return runAction(context, ...args);
      }

      const startedAt = performance.now();

      try {
        const result = runAction(context, ...args);
        emitStoreActionDevtoolsEvent(String(key), "success", startedAt);

        return result;
      } catch (error) {
        emitStoreActionDevtoolsEvent(String(key), "error", startedAt);
        throw error;
      }
    }) as StoreActionMethods<Actions>[keyof Actions];
  }

  return {
    state,
    getters,
    actions,
  };
}

function emitStoreActionDevtoolsEvent(
  name: string,
  status: Extract<DevtoolsEvent, { type: "store:action" }>["status"],
  startedAt: number,
): void {
  emitDevtoolsEvent({
    type: "store:action",
    name,
    status,
    durationMs: performance.now() - startedAt,
  });
}
