export function boundaryStartMarker(id: number): string {
  return `<!--so:b:${id}-->`;
}

export function boundaryEndMarker(id: number): string {
  return `<!--/so:b:${id}-->`;
}

export function boundaryFailureMarker(id: number, message: string): string {
  return `<!--so:b:${id} failed:${message}-->`;
}

export interface PendingBoundary {
  id: number;
  ready: Promise<void>;
  error: unknown;
  component: unknown;
}

export function createPendingBoundary(id: number, load: Promise<unknown>): PendingBoundary {
  const boundary: PendingBoundary = {
    id,
    error: null,
    component: null,
    ready: null as never,
  };
  boundary.ready = load.then(
    (component) => {
      boundary.component = component;
    },
    (error) => {
      boundary.error = error;
    },
  );
  return boundary;
}
