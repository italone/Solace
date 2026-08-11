import { createApp, h, ref } from "@italone/solace";
import type { AsyncComponentType } from "@italone/solace";

const count = ref(0);
const AsyncCounter: AsyncComponentType = async () => {
  await Promise.resolve();
  return () =>
    h(
      "button",
      {
        id: "async-counter",
        type: "button",
        onClick: () => {
          count.value += 1;
        },
      },
      `count: ${count.value}`,
    );
};

const container = document.querySelector("#app");
if (container instanceof Element) {
  const serverNode = container.firstChild;
  void createApp(AsyncCounter)
    .hydrateAsync(container)
    .then(() => {
      container.setAttribute("data-hydrated", "true");
      container.setAttribute("data-node-reused", String(container.firstChild === serverNode));
    })
    .catch((error: unknown) => {
      console.error(error);
    });
}
