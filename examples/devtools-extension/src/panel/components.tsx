import { h } from "@italone/solace";
import type { PanelState, StoreActionEntry, TimelineFamily } from "./state";
import {
  clearTimeline,
  filterTimeline,
  getSelectedTimelineRow,
  getStoreActionEntries,
  selectTimelineEvent,
  setPanelPaused,
  setPanelView,
  setRecorderLimit,
  setTimelineFilter,
} from "./state";

export interface TimelinePanelProps {
  state: PanelState;
  onStateChange(nextState: PanelState): void;
}

export const timelineFamilies: TimelineFamily[] = [
  "component",
  "scheduler",
  "reactivity",
  "renderer",
  "store",
];

export function TimelinePanel(props: TimelinePanelProps) {
  return () => {
    const { state, onStateChange } = props;
    const rows = filterTimeline(state.events, state.filter);
    const selectedRow = getSelectedTimelineRow(state);
    const storeActions = getStoreActionEntries(state);

    function updateLimit(event: Event): void {
      const nextLimit = (event.target as HTMLInputElement).valueAsNumber;
      if (!Number.isInteger(nextLimit) || nextLimit < 1) {
        return;
      }

      onStateChange(setRecorderLimit(state, nextLimit));
    }

    function toggleFamily(family: TimelineFamily): void {
      const nextFamily = state.filter.family === family ? undefined : family;
      onStateChange(setTimelineFilter(state, { family: nextFamily }));
    }

    return h("main", { class: "panel-shell" }, [
      h("header", { class: "panel-toolbar" }, [
        h("div", { class: "panel-actions", "aria-label": "Capture controls" }, [
          h(
            "button",
            {
              class: "panel-button",
              type: "button",
              "aria-pressed": state.paused,
              onClick: () => onStateChange(setPanelPaused(state, !state.paused)),
            },
            state.paused ? "Resume" : "Pause",
          ),
          h(
            "button",
            {
              class: "panel-button",
              type: "button",
              onClick: () => onStateChange(clearTimeline(state)),
            },
            "Clear",
          ),
        ]),
        h("label", { class: "limit-control" }, [
          h("span", null, "Limit"),
          h("input", {
            name: "recorder-limit",
            min: "1",
            step: "1",
            type: "number",
            value: state.limit,
            onChange: updateLimit,
          }),
        ]),
      ]),
      h(
        "nav",
        {
          class: "panel-tabs",
          "data-testid": "panel-tabs",
          "aria-label": "Panel views",
        },
        (["timeline", "store"] as const).map((view) =>
          h(
            "button",
            {
              class: "tab-button",
              type: "button",
              "aria-pressed": state.view === view,
              onClick: () => onStateChange(setPanelView(state, view)),
            },
            view === "timeline" ? "Timeline" : "Store",
          ),
        ),
      ),
      ...(state.view === "store"
        ? [
            h(
              "section",
              { class: "store-pane", "aria-label": "Store actions" },
              [StoreActions({ actions: storeActions })],
            ),
          ]
        : [
      h(
        "nav",
        {
          class: "family-filters",
          "data-testid": "family-filters",
          "aria-label": "Family filters",
        },
        timelineFamilies.map((family) =>
          h(
            "button",
            {
              class: "filter-button",
              type: "button",
              "aria-pressed": state.filter.family === family,
              onClick: () => toggleFamily(family),
            },
            family,
          ),
        ),
      ),
      h("section", { class: "panel-grid" }, [
        h("section", { class: "timeline-pane", "aria-label": "Timeline" }, [
          h(
            "ol",
            {
              class: "timeline-list",
              "data-testid": "timeline-list",
              "aria-label": "Timeline events",
            },
            rows.map((row) =>
              h("li", { key: row.id }, [
                h(
                  "button",
                  {
                    class: "timeline-row",
                    type: "button",
                    "aria-pressed": state.selectedEventId === row.id,
                    onClick: () => onStateChange(selectTimelineEvent(state, row.id)),
                  },
                  [h("strong", null, row.event.type), h("span", null, row.summary)],
                ),
              ]),
            ),
          ),
        ]),
        h(
          "aside",
          {
            class: "details-pane",
            "data-testid": "event-details",
            "aria-label": "Selected event details",
          },
          [
            h(
              "pre",
              null,
              selectedRow === undefined ? "" : JSON.stringify(selectedRow.event, null, 2),
            ),
          ],
        ),
      ]),
          ]),
    ]);
  };
}

export function StoreActions(props: { actions: StoreActionEntry[] }) {
  return h(
    "ul",
    { class: "store-action-list", "data-testid": "store-actions", "aria-label": "Store actions" },
    props.actions.map((action) =>
      h("li", { key: action.id }, [
        h("strong", null, `${action.time}: ${action.type}`),
        h("span", null, `${action.status} in ${action.durationMs.toFixed(2)}ms`),
      ]),
    ),
  );
}
