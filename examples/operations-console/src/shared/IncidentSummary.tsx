import { useStyle } from "@italone/solace";

export interface IncidentSummaryProps {
  openCount: number;
  label?: string;
  onIncrement?: () => void;
  incrementLabel?: string;
}

const summaryStyles = `
.operations-summary {
  max-width: 28rem;
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem 1rem;
  align-items: center;
  color: #20252c;
  background: #ffffff;
  border: 1px solid #d7dce1;
  border-radius: 6px;
}
.operations-summary__label {
  margin: 0;
  color: #646d78;
  font-size: 0.875rem;
  font-weight: 700;
}
.operations-summary__count {
  grid-row: span 2;
  font-size: 1.75rem;
  font-variant-numeric: tabular-nums;
}
.operations-summary__button {
  width: fit-content;
  min-height: 2.25rem;
  padding: 0.45rem 0.75rem;
  color: #ffffff;
  background: #185b43;
  border: 1px solid #124632;
  border-radius: 4px;
  cursor: pointer;
}
`;

export function IncidentSummary(props: IncidentSummaryProps) {
  useStyle("operations-console-incident-summary", summaryStyles);

  return (
    <section data-operations-summary="" class="operations-summary">
      <p class="operations-summary__label">{props.label ?? "Open incidents"}</p>
      <strong class="operations-summary__count">{String(props.openCount)}</strong>
      <button type="button" class="operations-summary__button" onClick={props.onIncrement}>
        {props.incrementLabel ?? "Increment open incidents"}
      </button>
    </section>
  );
}
