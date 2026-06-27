import { resolveCodexHome } from './codex-home.mjs';
import { discoverCodexSessionRecords, resolveCodexTarget } from './codex-session-index.mjs';
import { summarizeCodexSession } from './codex-session-summary.mjs';

export const codexAdapter = {
  id: 'codex',
  supportedRecordKinds: ['codex-jsonl'],
  resolveHome: resolveCodexHome,
  resolveTarget: resolveCodexTarget,
  discoverSessions: discoverCodexSessionRecords,
  summarizeSession: summarizeCodexSession,
};
