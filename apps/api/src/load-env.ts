import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Import first in every entrypoint (server, migrate, set-role). Reads the
// repository root's .env.local, then .env. Values from .env.local always win
// for application settings and API keys.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

for (const name of [".env", ".env.local"]) {
  const filePath = resolve(root, name);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          // .env.local values always override any inherited process environment
          if (name === ".env.local" || process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
