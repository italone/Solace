import { createApp, ref } from "@italone/solace";

const count = ref(1);

const MatchingSummary = () => () => (
  <button id="hydration-count" onClick={() => (count.value += 1)}>
    count: {count.value}
  </button>
);
const RecoverySummary = () => <p id="recovered-client-node">recovered client output</p>;

function requireElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!(element instanceof Element)) throw new Error(`Missing hydration element: ${selector}`);
  return element;
}

const matchingRoot = requireElement("#matching-root");
const serverNode = matchingRoot.firstElementChild;
createApp(MatchingSummary).hydrate(matchingRoot);
requireElement("#matching-status").textContent =
  matchingRoot.firstElementChild === serverNode ? "server node reused" : "server node replaced";

createApp(RecoverySummary).hydrate(requireElement("#recovery-root"), { recover: true });
requireElement("#recovery-status").textContent = "mismatch recovered";
