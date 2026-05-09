/* eslint-disable no-console */
/**
 * Guard: running `next build` while `next dev` is running can corrupt `.next` and cause
 * "Cannot find module './xxxx.js'" server chunk errors on Windows.
 *
 * We fail fast with a clear instruction instead of letting `.next` get clobbered.
 */

const { execSync } = require("node:child_process");

function hasNextDevProcess() {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      const out = execSync(
        `wmic process where "name='node.exe'" get CommandLine /FORMAT:LIST`,
        { stdio: ["ignore", "pipe", "ignore"] }
      ).toString("utf8");
      return /next\\dist\\bin\\next"\s+dev\b/i.test(out) || /\bnext\b.*\bdev\b/i.test(out);
    }
    const out = execSync(`ps -ax -o command`, {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString("utf8");
    return /\bnext\b.*\bdev\b/.test(out);
  } catch {
    return false;
  }
}

if (hasNextDevProcess()) {
  console.error(
    [
      "",
      "Refusing to run `next build` while `next dev` is running.",
      "This can corrupt `.next` and cause server errors like:",
      "  Error: Cannot find module './9380.js'",
      "",
      "Fix: stop the dev server first, then rerun the build.",
      "Tip: for a clean dev restart, use `npm run dev:clean`.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

