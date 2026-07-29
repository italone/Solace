import { onDevtoolsEvent } from "@italone/solace/devtools";
import { reactive, render } from "@italone/solace";

import { TimelinePanel } from "./components";
import { createPanelState, recordDevtoolsEvent, type PanelState } from "./state";
import "./styles.css";

const panelState = reactive(createPanelState());

onDevtoolsEvent((event) => {
  replacePanelState(recordDevtoolsEvent(panelState, event));
});

function replacePanelState(nextState: PanelState): void {
  panelState.paused = nextState.paused;
  panelState.limit = nextState.limit;
  panelState.filter = nextState.filter;
  panelState.selectedEventId = nextState.selectedEventId;
  panelState.events = nextState.events;
  panelState.nextEventId = nextState.nextEventId;
}

const app = document.querySelector("#app");
if (app !== null) {
  render(<TimelinePanel state={panelState} onStateChange={replacePanelState} />, app);
}
