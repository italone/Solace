export function hasReleaseCheckCommand(releaseCheck, command) {
  return typeof releaseCheck === "string" && releaseCheck.split(" && ").includes(command);
}
