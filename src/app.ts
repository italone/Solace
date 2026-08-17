import { h } from "./vnode/h";
import { hydrate, hydrateAsync, render } from "./renderer/renderer";
import type { HydrationOptions } from "./renderer/renderer";
import type { ProvideKey, Provides } from "./component/provide";
import type { AsyncComponentType, ComponentTransport, VNode } from "./vnode/vnode";

export type PluginInstall = (app: App, ...options: unknown[]) => void;

export interface PluginObject {
  install: PluginInstall;
}

export type Plugin = PluginInstall | PluginObject;

export interface App {
  mount(container: Element): void;
  hydrate(container: Element, options?: HydrationOptions): void;
  hydrateAsync(container: Element, options?: HydrationOptions): Promise<void>;
  provide<T>(key: ProvideKey, value: T): App;
  use(plugin: Plugin, ...options: unknown[]): App;
}

export function createApp(rootComponent: ComponentTransport | AsyncComponentType | VNode): App {
  const installedPlugins = new Set<Plugin>();
  const appProvides: Provides = new Map();
  const app: App = {
    mount(container: Element): void {
      const vnode =
        typeof rootComponent === "function"
          ? h(rootComponent as ComponentTransport)
          : rootComponent;
      render(vnode, container, appProvides);
    },
    hydrate(container: Element, options?: HydrationOptions): void {
      const vnode =
        typeof rootComponent === "function"
          ? h(rootComponent as ComponentTransport)
          : rootComponent;
      hydrate(vnode, container, appProvides, options);
    },
    hydrateAsync(container: Element, options?: HydrationOptions): Promise<void> {
      const vnode =
        typeof rootComponent === "function"
          ? h(rootComponent as ComponentTransport)
          : rootComponent;
      return hydrateAsync(vnode, container, appProvides, options);
    },
    provide<T>(key: ProvideKey, value: T): App {
      appProvides.set(key, value);
      return app;
    },
    use(plugin: Plugin, ...options: unknown[]): App {
      if (installedPlugins.has(plugin)) {
        return app;
      }

      installedPlugins.add(plugin);

      if (typeof plugin === "function") {
        plugin(app, ...options);
      } else {
        plugin.install(app, ...options);
      }

      return app;
    },
  };

  return app;
}
