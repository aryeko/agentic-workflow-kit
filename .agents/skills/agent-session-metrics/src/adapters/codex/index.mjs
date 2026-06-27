import { resolveCodexHome } from './codex-home.mjs';
import { discoverCodexSessionRecords, extractCodexSessions, resolveCodexTarget } from './codex-session-index.mjs';
import { summarizeCodexSession } from './codex-session-summary.mjs';

export const codexAdapter = {
  id: 'codex',
  supportedRecordKinds: ['codex-jsonl'],
  resolveHome: resolveCodexHome,
  resolveTarget: resolveCodexTarget,
  extractSessions: extractCodexSessions,
  discoverSessions: discoverCodexSessionRecords,
  summarizeSession: summarizeCodexSession,
};
