export function createPnpmSpawnOptions(
  cwd: string,
  platform?: NodeJS.Platform,
): {
  cwd: string;
  stdio: "inherit";
  shell: boolean;
};
export function discoverBrowserEntry(indexHtml: string, browserDir: string): string;
