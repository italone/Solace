export function createPlaywrightWebServerEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  const env: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(sourceEnv)) {
    if (key === "NO_COLOR" || value === undefined) {
      continue;
    }

    env[key] = value;
  }

  env.NO_COLOR = undefined;
  return env as Record<string, string>;
}

export function sanitizePlaywrightProcessEnv(env: NodeJS.ProcessEnv = process.env): void {
  delete env.NO_COLOR;
}
