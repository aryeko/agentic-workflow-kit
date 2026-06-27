import { homedir } from 'node:os';
import { resolve } from 'node:path';

export async function resolveCodexHome({ providerHome } = {}) {
  return resolve(providerHome || process.env.CODEX_HOME || `${homedir()}/.codex`);
}
