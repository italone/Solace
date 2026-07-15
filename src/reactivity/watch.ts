import { ReactiveEffect } from "./effect";

export type WatchSource<T> = () => T;
export type WatchCallback<T> = (newValue: T, oldValue: T) => void;
export type WatchEffect = () => void;
export type WatchStopHandle = () => void;

export function watch<T>(source: WatchSource<T>, callback: WatchCallback<T>): WatchStopHandle {
  let oldValue: T;

  const job = (): void => {
    const newValue = reactiveEffect.run();
    callback(newValue, oldValue);
    oldValue = newValue;
  };

  const reactiveEffect = new ReactiveEffect(source, job);
  oldValue = reactiveEffect.run();

  return () => {
    reactiveEffect.stop();
  };
}

export function watchEffect(effect: WatchEffect): WatchStopHandle {
  const reactiveEffect = new ReactiveEffect(effect);
  reactiveEffect.run();

  return () => {
    reactiveEffect.stop();
  };
}
