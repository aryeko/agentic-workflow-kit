import { codexSessionDataTypes, extractCodexSessionData } from './codex-session-extractor.mjs';

export async function summarizeCodexSession({ recordPath }) {
  return extractCodexSessionData({
    recordPath,
    dataTypes: [
      codexSessionDataTypes.sessionMeta,
      codexSessionDataTypes.spawnedSessions,
      codexSessionDataTypes.metrics,
    ],
  });
}
