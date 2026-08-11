import { createApp, ref } from "@italone/solace";

import { IncidentSummary } from "../shared/IncidentSummary";
import "../shared/styles.css";

const matchingCount = ref(3);
const recoveryCount = ref(1);

function MatchingSummary() {
  return () => (
    <IncidentSummary
      openCount={matchingCount.value}
      onIncrement={() => {
        matchingCount.value += 1;
      }}
    />
  );
}

function RecoverySummary() {
  return () => (
    <IncidentSummary
      openCount={recoveryCount.value}
      label="Recovered incidents"
      incrementLabel="Increment recovered count"
      onIncrement={() => {
        recoveryCount.value += 1;
      }}
    />
  );
}

function requireElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (element === null) {
    throw new Error(`Required hydration element was not found: ${selector}`);
  }

  return element;
}

const matchingRoot = requireElement("#matching-root");
const matchingResult = requireElement("#matching-result");
const recoveryRoot = requireElement("#recovery-root");
const recoveryResult = requireElement("#recovery-result");
const serverNode = matchingRoot.firstElementChild;

if (serverNode === null) {
  throw new Error("Matching hydration root must contain a server-rendered element");
}

createApp(MatchingSummary).hydrate(matchingRoot);
if (matchingRoot.firstElementChild !== serverNode) {
  throw new Error("Matching hydration replaced the server-rendered node");
}
matchingResult.textContent = "server node reused";

createApp(RecoverySummary).hydrate(recoveryRoot, { recover: true });
recoveryResult.textContent = "mismatch recovered";
