/* config.js — credential + settings storage for the fons CLI.
   Tokens live in a mode-0600 JSON file under the user's config dir (the same
   convention gh/aws use). NOT a keychain in v1 — documented in README; a keychain
   backend is a future enhancement. Never logged, never world-readable. */
import { mkdir, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = process.env.FONS_CONFIG_DIR || join(homedir(), ".config", "fons");
const FILE = join(DIR, "credentials.json");

export async function loadConfig() {
  try { return JSON.parse(await readFile(FILE, "utf8")); }
  catch { return {}; }
}

export async function saveConfig(obj) {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  await writeFile(FILE, JSON.stringify(obj, null, 2), { mode: 0o600 });
  try { await chmod(FILE, 0o600); } catch { /* best effort on platforms without chmod */ }
}

export async function clearConfig() {
  try { await rm(FILE); } catch { /* already gone */ }
}

export const configPath = FILE;
