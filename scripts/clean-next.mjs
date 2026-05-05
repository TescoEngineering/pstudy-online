/**
 * Removes Next / webpack output so a fresh compile cannot load stale chunks.
 * Stop `npm run dev` first — otherwise Windows may leave files locked.
 */
import { rmSync } from "fs";
import { join } from "path";

const root = process.cwd();
const dirs = [".next", join("node_modules", ".cache")];

for (const rel of dirs) {
  const p = join(root, rel);
  try {
    rmSync(p, { recursive: true, force: true });
    console.log(`Removed ${rel}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to remove ${rel}: ${msg}`);
    process.exit(1);
  }
}
