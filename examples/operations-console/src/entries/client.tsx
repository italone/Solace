import { createApp } from "@italone/solace";

import { App } from "../app/App";
import { operationsRouter } from "../app/router";
import "../shared/styles.css";

const root = document.querySelector("#app");

if (root === null) {
  throw new Error("Operations console root element was not found");
}

createApp(App).use(operationsRouter).mount(root);
