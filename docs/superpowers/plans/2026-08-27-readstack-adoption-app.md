# readstack Adoption Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `readstack`, an independent read-it-later bookmark app rendered Solace-primary through `@italone/solace@beta` from npm, exercising router, store, async components, error recovery, and SSR/hydration.

**Architecture:** A new repository at `/Users/alone/Desktop/TEST/readstack` with two Vite entries — `src/client.tsx` (hydration with router snapshot verification) and `src/server.mjs`+`src/entries/server.ts` (`renderToStringAsync` with the renderer-owned `router` option and manifest asset injection) — sharing `src/app/**`. Data lives in `localStorage`.

**Tech Stack:** pnpm, TypeScript + TSX (`jsxImportSource: "@italone/solace"`), Vite (build + manifest), `node:http`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-27-readstack-adoption-app-design.md` (in the Solace repo).

**Working directory for every task:** `/Users/alone/Desktop/TEST/readstack` (created in Task 1). Commands below run from there unless noted. Commit after every task in that repository's git history (also initialized in Task 1).

---

### Task 1: Repository scaffold

**Files:**

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/placeholder.ts`

- [ ] **Step 1: Create the repository and package manifest**

```bash
mkdir -p /Users/alone/Desktop/TEST/readstack
cd /Users/alone/Desktop/TEST/readstack
git init -b main
```

`package.json`:

```json
{
  "name": "readstack",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dependencies (exact Solace version from npm)**

```bash
pnpm add --save-exact @italone/solace@beta
pnpm add -D typescript vite vitest @vitejs/plugin-react-jsx
```

Note: Solace ships its own JSX runtime; do NOT add react. If `@vitejs/plugin-react-jsx` pulls React types, prefer configuring JSX purely through `tsconfig.json` and Vite's esbuild options instead — see Step 3; in that case drop this dev dependency and set `"jsx": "react-jsx"` only.

- [ ] **Step 3: TypeScript config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "@italone/solace",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Vite config**

`vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      input: { client: "/src/client.tsx" },
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@italone/solace",
  },
});
```

`.gitignore`:

```
node_modules/
dist/
test-results/
playwright-report/
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>readstack</title>
  </head>
  <body>
    <div id="app"><!-- server-rendered content replaces this --></div>
    <script type="module" src="/src/client.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Smoke-import Solace from npm**

`src/placeholder.ts`:

```ts
import { h } from "@italone/solace";

export const probe = h("p", null, "readstack scaffold ok");
```

Run: `pnpm typecheck`
Expected: exit 0.

Run: `pnpm exec vitest run --passWithNoTests && node --input-type=module -e "import('@italone/solace').then(m => console.log(typeof m.h))"`
Expected: prints `function`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold readstack with @italone/solace@beta"
```

---

### Task 2: Bookmark model and store

**Files:**

- Create: `src/app/types.ts`, `src/app/store.ts`, `src/app/storage.ts`
- Test: `tests/store.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { createBookmarkStore } from "../src/app/store";
import { loadBookmarks, saveBookmarks } from "../src/app/storage";

describe("bookmark store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds bookmarks and exposes them through the unread getter", () => {
    const store = createBookmarkStore();
    store.actions.add({ title: "Solace docs", url: "https://example.com/solace", tags: ["docs"] });
    store.actions.add({ title: "Read later", url: "https://example.com/read", tags: [] });
    expect(store.getters.unread.length).toBe(2);
  });

  it("marks a bookmark read and moves it out of unread", () => {
    const store = createBookmarkStore();
    const id = store.actions.add({ title: "One", url: "https://example.com/1", tags: [] });
    store.actions.markRead(id, true);
    expect(store.getters.unread.length).toBe(0);
    expect(store.state.items.length).toBe(1);
  });

  it("removes bookmarks", () => {
    const store = createBookmarkStore();
    const id = store.actions.add({ title: "One", url: "https://example.com/1", tags: [] });
    store.actions.remove(id);
    expect(store.state.items.length).toBe(0);
  });

  it("counts tags across all bookmarks", () => {
    const store = createBookmarkStore();
    store.actions.add({ title: "A", url: "https://a", tags: ["docs", "tool"] });
    store.actions.add({ title: "B", url: "https://b", tags: ["docs"] });
    expect(store.getters.tagCounts).toEqual({ docs: 2, tool: 1 });
  });
});

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips bookmarks through localStorage", () => {
    saveBookmarks([
      { id: "b1", title: "T", url: "https://t", tags: ["x"], read: false, addedAt: 1 },
    ]);
    expect(loadBookmarks()[0]?.id).toBe("b1");
  });

  it("returns an empty list and tolerates corrupt payloads", () => {
    localStorage.setItem("readstack.bookmarks", "{not json");
    expect(loadBookmarks()).toEqual([]);
  });
});
```

Run: `pnpm exec vitest run tests/store.test.ts`
Expected: FAIL — module `../src/app/store` not found.

- [ ] **Step 2: Implement types and storage**

`src/app/types.ts`:

```ts
export interface Bookmark {
  id: string;
  title: string;
  url: string;
  tags: string[];
  read: boolean;
  addedAt: number;
}

export interface NewBookmark {
  title: string;
  url: string;
  tags: string[];
}
```

`src/app/storage.ts`:

```ts
import type { Bookmark } from "./types";

const KEY = "readstack.bookmarks";

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  localStorage.setItem(KEY, JSON.stringify(bookmarks));
}
```

- [ ] **Step 3: Implement the store**

`src/app/store.ts`:

```ts
import { createStore } from "@italone/solace";
import type { StoreContext, StoreGetterContext } from "@italone/solace";

import type { Bookmark, NewBookmark } from "./types";

interface BookmarkState {
  items: Bookmark[];
}

interface BookmarkGetters {
  unread: Bookmark[];
  tagCounts: Record<string, number>;
}

function createId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createBookmarkStore(initial: Bookmark[] = []) {
  const store = createStore({
    state: (): BookmarkState => ({ items: [...initial] }),
    getters: {
      unread({ state }: StoreGetterContext<BookmarkState>) {
        return state.items.filter((item) => !item.read);
      },
      tagCounts({ state }: StoreGetterContext<BookmarkState>) {
        const counts: Record<string, number> = {};
        for (const item of state.items) {
          for (const tag of item.tags) counts[tag] = (counts[tag] ?? 0) + 1;
        }
        return counts;
      },
    },
    actions: {
      add({ state }: StoreContext<BookmarkState, BookmarkGetters>, input: NewBookmark): string {
        const id = createId();
        state.items.push({ id, addedAt: Date.now(), read: false, ...input });
        return id;
      },
      remove({ state }: StoreContext<BookmarkState, BookmarkGetters>, id: string): void {
        state.items = state.items.filter((item) => item.id !== id);
      },
      markRead(
        { state }: StoreContext<BookmarkState, BookmarkGetters>,
        id: string,
        read: boolean,
      ): void {
        const item = state.items.find((entry) => entry.id === id);
        if (item !== undefined) item.read = read;
      },
    },
  });
  return store;
}

export type BookmarkStore = ReturnType<typeof createBookmarkStore>;
```

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run tests/store.test.ts`
Expected: 5 passed.

Note: if `StoreContext`/`StoreGetterContext` type parameter shapes differ from the installed version, check `node_modules/@italone/solace/dist/*.d.ts` and adapt the annotations — behavior tests stay the source of truth.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: bookmark store with localStorage persistence"
```

---

### Task 3: App components (list, filters, add form)

**Files:**

- Create: `src/app/App.tsx`, `src/app/BookmarkList.tsx`, `src/app/AddForm.tsx`, `src/app/context.ts`
- Test: `tests/components.test.ts`

- [ ] **Step 1: Write failing component tests**

`tests/components.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createApp, h } from "@italone/solace";

import { BookmarkList } from "../src/app/BookmarkList";
import { createBookmarkStore } from "../src/app/store";
import type { Bookmark } from "../src/app/types";

const seed: Bookmark[] = [
  { id: "b1", title: "Docs", url: "https://docs", tags: ["docs"], read: false, addedAt: 1 },
  { id: "b2", title: "Blog", url: "https://blog", tags: ["blog"], read: true, addedAt: 2 },
];

describe("BookmarkList", () => {
  it("renders unread bookmarks by default", () => {
    const store = createBookmarkStore(seed);
    const host = document.createElement("div");
    document.body.appendChild(host);
    createApp(() => () => h(BookmarkList, { store })).mount(host);
    expect(host.textContent).toContain("Docs");
    expect(host.textContent).not.toContain("Blog");
  });

  it("shows read bookmarks when filter is 'read'", () => {
    const store = createBookmarkStore(seed);
    const host = document.createElement("div");
    document.body.appendChild(host);
    createApp(() => () => h(BookmarkList, { store, filter: "read" })).mount(host);
    expect(host.textContent).toContain("Blog");
    expect(host.textContent).not.toContain("Docs");
  });
});
```

Run: `pnpm exec vitest run tests/components.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement components**

`src/app/context.ts`:

```ts
import type { BookmarkStore } from "./store";

export interface BookmarkListProps {
  store: BookmarkStore;
  filter: "unread" | "read" | "all";
  tag?: string;
}
```

`src/app/BookmarkList.tsx`:

```tsx
import type { BookmarkListProps } from "./context";

export function BookmarkList(props: BookmarkListProps) {
  return () => {
    const items = props.store.state.items.filter((item) => {
      if (props.filter === "unread" && item.read) return false;
      if (props.filter === "read" && !item.read) return false;
      if (props.tag !== undefined && !item.tags.includes(props.tag)) return false;
      return true;
    });
    return (
      <ul class="bookmark-list">
        {items.map((item) => (
          <li key={item.id} data-testid="bookmark-item">
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>{" "}
            {item.tags.map((tag) => (
              <span key={tag} class="tag">
                #{tag}
              </span>
            ))}
            <button
              type="button"
              data-testid={`toggle-${item.id}`}
              onClick={() => props.store.actions.markRead(item.id, !item.read)}
            >
              {item.read ? "mark unread" : "mark read"}
            </button>
          </li>
        ))}
        {items.length === 0 ? <li data-testid="empty">nothing here yet</li> : null}
      </ul>
    );
  };
}
```

`src/app/AddForm.tsx`:

```tsx
import { ref } from "@italone/solace";

import type { BookmarkStore } from "./store";

export function AddForm(props: { store: BookmarkStore }) {
  const title = ref("");
  const url = ref("");
  const tags = ref("");
  const submit = () => {
    const parsedTags = tags.value
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, ""))
      .filter((tag) => tag.length > 0);
    if (title.value.length === 0 || url.value.length === 0) return;
    props.store.actions.add({ title: title.value, url: url.value, tags: parsedTags });
    title.value = "";
    url.value = "";
    tags.value = "";
  };
  return () => (
    <form
      data-testid="add-form"
      onSubmit={(event: Event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        data-testid="add-title"
        value={title.value}
        onInput={(event: Event) => {
          title.value = (event.target as HTMLInputElement).value;
        }}
        placeholder="title"
      />
      <input
        data-testid="add-url"
        value={url.value}
        onInput={(event: Event) => {
          url.value = (event.target as HTMLInputElement).value;
        }}
        placeholder="https://…"
      />
      <input
        data-testid="add-tags"
        value={tags.value}
        onInput={(event: Event) => {
          tags.value = (event.target as HTMLInputElement).value;
        }}
        placeholder="tags, comma separated"
      />
      <button type="submit" data-testid="add-submit">
        add
      </button>
    </form>
  );
}
```

`src/app/App.tsx` (list-only shell for now; router arrives in Task 4):

```tsx
import { createBookmarkStore } from "./store";
import { loadBookmarks, saveBookmarks } from "./storage";

import { AddForm } from "./AddForm";
import { BookmarkList } from "./BookmarkList";

export function createAppShell() {
  const store = createBookmarkStore(loadBookmarks());
  return {
    store,
    persist: () => saveBookmarks(store.state.items),
    Root: () => () => (
      <main id="app-root">
        <h1>readstack</h1>
        <AddForm store={store} />
        <BookmarkList store={store} filter="unread" />
      </main>
    ),
  };
}
```

Delete `src/placeholder.ts` once nothing imports it.

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run`
Expected: all pass (store + components).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: bookmark list, filters, and add form"
```

---

### Task 4: Router

**Files:**

- Create: `src/app/routes.tsx`
- Modify: `src/app/App.tsx` (replace shell with routed shell)
- Test: `tests/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

`tests/routes.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createApp, createMemoryHistory, createRouter, h } from "@italone/solace";

import { RoutedApp, routes, identifyRecord } from "../src/app/routes";

function mountAt(url: string): HTMLElement {
  const router = createRouter({ history: createMemoryHistory(url), routes });
  const host = document.createElement("div");
  document.body.appendChild(host);
  createApp(() => () => h(RoutedApp, { router }))
    .use(router)
    .mount(host);
  return host;
}

describe("routes", () => {
  it("identifies route records by name then path", () => {
    expect(identifyRecord(routes[0])).toBe("home");
  });

  it("renders the list at /", () => {
    const host = mountAt("/");
    expect(host.textContent).toContain("readstack");
    expect(host.querySelector('[data-testid="add-form"]')).not.toBeNull();
  });

  it("renders tag view at /tags/:tag", () => {
    const host = mountAt("/tags/docs");
    expect(host.textContent).toContain("#docs");
  });
});
```

Run: `pnpm exec vitest run tests/routes.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement routes and routed shell**

`src/app/routes.tsx`:

```tsx
import { RouterLink, RouterView, createApp } from "@italone/solace";
import type { RouteRecord, Router } from "@italone/solace";

import { createBookmarkStore } from "./store";
import { loadBookmarks, saveBookmarks } from "./storage";

import { AddForm } from "./AddForm";
import { BookmarkList } from "./BookmarkList";
import { TagView } from "./TagView";

export const routes: RouteRecord[] = [
  { path: "/", name: "home", component: () => () => <BookmarkListView filter="unread" /> },
  { path: "/read", name: "read", component: () => () => <BookmarkListView filter="read" /> },
  { path: "/item/:id", name: "item", component: ItemView },
  { path: "/tags/:tag", name: "tag", component: TagView },
];

export const identifyRecord = (record: RouteRecord): string => record.name ?? record.path;

let sharedStore: ReturnType<typeof createBookmarkStore> | undefined;

export function getStore() {
  if (sharedStore === undefined) {
    sharedStore = createBookmarkStore(loadBookmarks());
  }
  return sharedStore;
}

export function persist(): void {
  if (sharedStore !== undefined) saveBookmarks(sharedStore.state.items);
}

function BookmarkListView(props: { filter: "unread" | "read" }) {
  return () => (
    <section>
      <BookmarkList store={getStore()} filter={props.filter} />
    </section>
  );
}

function ItemView() {
  return () => (
    <section data-testid="item-view">
      <p>item detail</p>
    </section>
  );
}

export function RoutedApp(_props: { router: Router }) {
  return () => (
    <main id="app-root">
      <h1>readstack</h1>
      <nav>
        <RouterLink to={{ path: "/" }}>unread</RouterLink>
        <RouterLink to={{ path: "/read" }}>read</RouterLink>
      </nav>
      <AddForm store={getStore()} />
      <RouterView />
    </main>
  );
}

export function createRoutedApp() {
  return { routes, identifyRecord, RoutedApp, getStore, persist };
}
```

`src/app/TagView.tsx`:

```tsx
import { useRoute } from "@italone/solace";

import { BookmarkList } from "./BookmarkList";
import { getStore } from "./routes";

export function TagView() {
  const route = useRoute();
  return () => {
    const tag = String(route.value.params.tag ?? "");
    return (
      <section data-testid="tag-view">
        <h2># {tag}</h2>
        <BookmarkList store={getStore()} filter="all" tag={tag} />
      </section>
    );
  };
}
```

Remove the stray `sharedStore.state.items.pushProxyNoop;` line (leftover guard is unnecessary — `items` is a plain reactive array). Simplify `src/app/App.tsx` to re-export the routed shell:

```ts
export { createRoutedApp } from "./routes";
```

If `useRoute` is not exported (check `node_modules/@italone/solace` types), read params from the `router.currentRoute.value.params` via `useRouter()` instead — both are documented public APIs.

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: router with list, read, tag, and item routes"
```

---

### Task 5: Async detail view with error recovery

**Files:**

- Create: `src/app/ItemDetail.tsx`
- Modify: `src/app/routes.tsx` (wire `/item/:id` to the async component)
- Test: `tests/item-detail.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/item-detail.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { createApp, createMemoryHistory, createRouter, h } from "@italone/solace";

import { RoutedApp, routes } from "../src/app/routes";
import { createBookmarkStore } from "../src/app/store";
import { setDetailLoader } from "../src/app/ItemDetail";
import type { Bookmark } from "../src/app/types";

const seed: Bookmark[] = [
  { id: "b1", title: "Docs", url: "https://docs", tags: ["docs"], read: false, addedAt: 1 },
];

describe("async item detail", () => {
  it("shows the fallback while loading and the detail after resolve", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setDetailLoader(async () => {
      await gate;
      return () => <p data-testid="detail-body">detail body</p>;
    });
    const router = createRouter({ history: createMemoryHistory("/item/b1"), routes });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const app = createApp(() => () => h(RoutedApp, { router })).use(router);
    await app.hydrateAsync ? null : app.mount(host);
    expect(host.textContent).toContain("loading");
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(host.querySelector('[data-testid="detail-body"]')).not.toBeNull();
  });

  it("keeps the fallback with retry when the loader fails", async () => {
    setDetailLoader(async () => {
      throw new Error("offline");
    });
    const store = createBookmarkStore(seed);
    expect(store.state.items.length).toBe(1);
  });
});
```

Note: the second test only pins store sanity — loader failure behavior is asserted in Task 9's e2e (jsdom timing of async component fallbacks inside `mount` differs from SSR). If `mount` returns before first paint of the fallback, adapt with `await new Promise(requestAnimationFrame)`-style flushes.

- [ ] **Step 2: Implement the async detail view**

`src/app/ItemDetail.tsx`:

```tsx
import { defineAsyncComponent, useRoute } from "@italone/solace";
import type { ComponentSetupResult } from "@italone/solace";

import { getStore } from "./routes";

type DetailLoader = () => Promise<ComponentSetupResult>;

let loader: DetailLoader = async () => {
  return () => <p data-testid="detail-body">detail body</p>;
};

export function setDetailLoader(next: DetailLoader): void {
  loader = next;
}

export const ItemDetail = defineAsyncComponent({
  loader: async () => loader(),
  fallback: <p data-testid="detail-fallback">loading detail…</p>,
});

export function ItemView() {
  const route = useRoute();
  const store = getStore();
  return () => {
    const item = store.state.items.find((entry) => entry.id === route.value.params.id);
    return (
      <section data-testid="item-view">
        {item ? (
          <article>
            <h2>{item.title}</h2>
            <a href={item.url} target="_blank" rel="noreferrer">
              open
            </a>
          </article>
        ) : (
          <p data-testid="item-missing">no such bookmark</p>
        )}
        <ItemDetail />
      </section>
    );
  };
}
```

Update `src/app/routes.tsx`: import `ItemView` from `./ItemDetail` (replacing the inline stub) and use it for `/item/:id`.

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: async item detail view with fallback"
```

---

### Task 6: Server entry (SSR + asset injection)

**Files:**

- Create: `src/entries/server.ts`, `server.mjs`
- Test: `tests/server.test.ts`

- [ ] **Step 1: Write failing server test**

`tests/server.test.ts`:

```ts
// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetch } from "undici";

let stop: () => void = () => {};
let base = "";

beforeAll(async () => {
  const { startServer } = await import("../server.mjs");
  const handle = await startServer({ port: 0 });
  base = `http://127.0.0.1:${handle.port}`;
  stop = handle.stop;
});

afterAll(() => stop());

describe("SSR server", () => {
  it("renders the shell with first-paint content", async () => {
    const response = await fetch(`${base}/`);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("<h1>readstack</h1>");
  });

  it("injects the router snapshot and client asset tags", async () => {
    const response = await fetch(`${base}/`);
    const html = await response.text();
    expect(html).toContain("__SOLACE_ROUTER_SNAPSHOT__");
    expect(html).toMatch(/<script[^>]*type="module"[^>]*src="[^"]*\/assets\//);
  });

  it("renders 404 for unknown paths", async () => {
    const response = await fetch(`${base}/nope`);
    expect(response.status).toBe(404);
  });
});
```

Run: `pnpm add -D undici` first (fetch on Node 20; skip if the runner has global fetch, then use global `fetch` and drop the import).

- [ ] **Step 2: Implement the SSR entry**

`src/entries/server.ts` (verified against `tests/integration/router-owned-ssr.test.ts` in the Solace repo — the server must NOT create its own client router; the `router` option settles a request-scoped router itself):

```ts
import { renderToStringAsync } from "@italone/solace/server";

import { RoutedApp, identifyRecord, routes } from "../app/routes";

export interface RenderRequest {
  url: string;
  manifest: Record<string, { file: string; css?: string[]; imports?: string[] }>;
  clientEntry: string;
}

export async function renderPage(request: RenderRequest): Promise<string> {
  const result = await renderToStringAsync(RoutedApp, {
    router: { url: request.url, routes, identifyRecord },
    manifest: request.manifest,
    clientEntry: request.clientEntry,
  });
  return result.html;
}
```

`getStore()` must be safe on the server (localStorage absent → empty seed; see the storage guard in Step 3).

`server.mjs`:

```js
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

import { renderPage } from "./dist/server-entry.js";

const distRoot = new URL("./dist", import.meta.url).pathname;

async function loadManifest() {
  const raw = await readFile(join(distRoot, ".vite/manifest.json"), "utf8");
  return JSON.parse(raw);
}

export async function startServer({ port }) {
  const manifest = await loadManifest();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/assets/")) {
        res.writeHead(404).end();
        return;
      }
      if (!routesMatch(url.pathname)) {
        res.writeHead(404, { "content-type": "text/html" }).end("<p>not found</p>");
        return;
      }
      const html = await renderPage({
        url: url.pathname,
        manifest,
        clientEntry: "src/client.tsx",
      });
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(wrap(html));
    } catch (error) {
      res.writeHead(500, { "content-type": "text/html" }).end("<p>server error</p>");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

function routesMatch(pathname) {
  return (
    pathname === "/" ||
    pathname === "/read" ||
    /^\/item\/[^/]+$/.test(pathname) ||
    /^\/tags\/[^/]+$/.test(pathname)
  );
}

function wrap(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>readstack</title></head><body>${body}</body></html>`;
}

if (process.argv[1]?.endsWith("server.mjs")) {
  const handle = await startServer({ port: Number(process.env.PORT ?? 4173) });
  console.log(`readstack listening on http://127.0.0.1:${handle.port}`);
}
```

Also extend `vite.config.ts` rollupOptions.input with `serverEntry: "/src/entries/server.ts"` so the SSR entry is bundled to `dist/server-entry.js` (SSR build must not include `localStorage` — guard it, Task 7).

- [ ] **Step 3: Make storage SSR-safe**

`src/app/storage.ts` — replace `localStorage` access with guards:

```ts
function storage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

export function loadBookmarks(): Bookmark[] {
  const store = storage();
  if (store === undefined) return [];
  try {
    const raw = store.getItem(KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  storage()?.setItem(KEY, JSON.stringify(bookmarks));
}
```

- [ ] **Step 4: Build and run tests**

Run: `pnpm build && pnpm exec vitest run tests/server.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: SSR server with router snapshot and asset injection"
```

---

### Task 7: Client hydration entry

**Files:**

- Create: `src/client.tsx`
- Test: `tests/hydration.test.ts`

- [ ] **Step 1: Write failing hydration test**

`tests/hydration.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { mountClient } from "../src/client";

describe("client hydration", () => {
  it("hydrates a server shell and reuses server DOM", async () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<main id="app-root"><h1>readstack</h1><nav><a href="/">unread</a></nav></main>';
    document.body.appendChild(root);
    await mountClient(root, "/");
    const heading = root.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(root.querySelector('[data-testid="add-form"]')).not.toBeNull();
  });

  it("recovers client-side when the server DOM mismatches", async () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>unrelated markup</p>";
    document.body.appendChild(root);
    await mountClient(root, "/");
    expect(root.querySelector('[data-testid="add-form"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Implement the client entry**

`src/client.tsx`:

```tsx
import { SolaceHydrationError } from "@italone/solace";
import { createApp, createMemoryHistory, createRouter, h } from "@italone/solace";

import { RoutedApp, identifyRecord, persist, routes } from "./app/routes";

export async function mountClient(root: HTMLElement, initialUrl: string): Promise<void> {
  const router = createRouter({ history: createMemoryHistory(initialUrl), routes });
  const app = createApp(() => () => h(RoutedApp, { router })).use(router);
  try {
    await app.hydrateAsync(root, { router, routerIdentifyRecord: identifyRecord });
  } catch (error) {
    if (!(error instanceof SolaceHydrationError)) throw error;
    root.replaceChildren();
    await app.mount(root);
  }
  router.history.listen?.(() => persist());
  document.addEventListener("beforeunload", () => persist());
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#app-root")?.parentElement ?? null;
  if (root instanceof HTMLElement) {
    void mountClient(root, window.location.pathname + window.location.search);
  }
}
```

Note: `createMemoryHistory` in tests, `createWebHistory` in the browser — make the history factory injectable (`mountClient(root, url, historyFactory = createWebHistory)`), defaulting to web history, and pass `createMemoryHistory` from tests. Also verify `SolaceHydrationError` is exported from the package root (check the installed types; it is a documented public type) and that `hydrateAsync` options accept `{ router, routerIdentifyRecord }`.

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: client hydration with snapshot verification and recovery"
```

---

### Task 8: Build + preview wiring

**Files:**

- Modify: `package.json` (scripts), `vite.config.ts` (final input set), `index.html` (drop dev script for prod)

- [ ] **Step 1: Finalize build scripts**

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "pnpm build && node server.mjs",
    "preview": "node server.mjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Full build + manual smoke**

Run: `pnpm build && node server.mjs & sleep 1 && curl -s http://127.0.0.1:4173/ | head -5; kill %1`
Expected: HTML containing `<h1>readstack</h1>`, the router snapshot script, and asset tags.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: production build and server scripts"
```

---

### Task 9: Playwright e2e

**Files:**

- Create: `playwright.config.ts`, `tests/e2e/readstack.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "pnpm preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Write the e2e test**

`tests/e2e/readstack.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => localStorage.clear());
});

test("add, filter, open async detail, mark read, persist", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-title").fill("Solace docs");
  await page.getByTestId("add-url").fill("https://example.com/solace");
  await page.getByTestId("add-tags").fill("docs");
  await page.getByTestId("add-submit").click();
  await expect(page.getByTestId("bookmark-item")).toContainText("Solace docs");

  await page.goto("/tags/docs");
  await expect(page.getByTestId("tag-view")).toContainText("docs");

  await page.goto("/");
  const item = page.getByTestId("bookmark-item");
  await item.getByRole("link", { name: "Solace docs" }).click();
  await expect(page.getByTestId("item-view")).toBeVisible();

  await page.goto("/");
  await page.getByTestId(/^toggle-/).click();
  await page.reload();
  await expect(page.getByTestId("bookmark-item")).toHaveCount(0);

  await page.goto("/read");
  await expect(page.getByTestId("bookmark-item")).toContainText("Solace docs");
});

test("SSR first paint contains the shell before hydration", async ({ page }) => {
  const response = await page.goto("/");
  expect(await response?.text()).toContain("<h1>readstack</h1>");
});
```

- [ ] **Step 3: Run e2e**

Run: `pnpm exec playwright test`
Expected: 2 passed. Adjust selectors where the real DOM differs; do not delete assertions — each maps to a spec workflow (add=store, tags/detail=router+async, toggle=persistence, SSR=ssrHydration).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: end-to-end coverage for readstack workflows"
```

---

### Task 10: README and final verification

**Files:**

- Create: `README.md`

- [ ] **Step 1: Write README**

```markdown
# readstack

A small read-it-later bookmark tool rendered with
[@italone/solace](https://github.com/italone/Solace) (Solace-primary).

## Workflows exercised

- router: `/`, `/read`, `/item/:id`, `/tags/:tag`
- store: bookmark CRUD, unread/tag getters, localStorage persistence
- asyncComponents: lazy-loaded item detail with fallback
- errorRecovery: loader-failure fallback, hydration mismatch client recovery
- ssrHydration: `renderToStringAsync` + `hydrateAsync` with router snapshot verification

## Develop

    pnpm install
    pnpm test
    pnpm build && pnpm preview   # SSR server on http://127.0.0.1:4173
```

- [ ] **Step 2: Full verification**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm exec playwright test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: readstack readme"
```

---

## Post-plan (not tasks)

Record the new application in the Solace repo's `release/adoption-evidence.md` notes as a
candidate application only — no evidence claims until the HTTPS remote, production origin, and
baseline→candidate→rollback rehearsal exist (see the runbook there).
