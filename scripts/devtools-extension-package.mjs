import {
  packageDevtoolsExtension,
  parseDevtoolsPackageArguments,
} from "./devtools-extension-package-config.mjs";

try {
  const options = parseDevtoolsPackageArguments(process.argv.slice(2));
  const result = await packageDevtoolsExtension(options);
  console.log(`DevTools package: ${result.outputPath}`);
  console.log(`DevTools package SHA-256: ${result.sha256}`);
  console.log(`DevTools package evidence: ${result.evidencePath}`);
  console.log(`DevTools inspected origins: ${result.origins.join(", ")}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
