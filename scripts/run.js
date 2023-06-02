import child_process from "node:child_process";

/**
 * @param {string} command
 * @param {{ input?: string }} options
 */
export function execSync(command, options = {}) {
  console.log("\x1b[1;34m> %s\x1b[0m", command);
  if (typeof options.input === "string") {
    child_process.execSync(command, {
      input: options.input,
      stdio: ["pipe", process.stdout, process.stderr],
    });
    return;
  }
  child_process.execSync(command, { stdio: "inherit" });
}
