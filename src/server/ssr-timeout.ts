export class SolaceTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolaceTimeoutError";
  }
}

export function assertTimeoutMs(value: unknown, label: string): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} timeoutMs must be a positive number`);
  }
}

export function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new SolaceTimeoutError(`SSR timed out after ${timeoutMs}ms (${label})`));
    }, timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
