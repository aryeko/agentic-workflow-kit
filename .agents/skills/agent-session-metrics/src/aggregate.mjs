import { addTokenBreakdown, zeroTokenBreakdown } from './contracts.mjs';

export function aggregateSessions(sessions) {
  const observedDurations = sessions
    .map((session) => session.durationMs)
    .filter((duration) => typeof duration === 'number' && Number.isFinite(duration));
  const tokenTotals = sessions.map((session) => session.tokenUsage?.total).filter(Boolean);

  return {
    sessionCount: sessions.length,
    rootCount: sessions.filter((session) => !session.parentSessionId).length,
    maxDepth: maxDepth(sessions),
    durationMs: observedDurations.length === 0 ? null : observedDurations.reduce((sum, duration) => sum + duration, 0),
    tokenUsage: tokenTotals.length === 0 ? null : tokenTotals.reduce(addTokenBreakdown, zeroTokenBreakdown()),
    byProvider: countBy(sessions, (session) => session.provider),
    byRole: countBy(sessions, (session) => session.agentRole ?? 'unavailable'),
    byModel: countBy(sessions, (session) => session.model ?? 'unavailable'),
    byEffort: countBy(sessions, (session) => session.effort ?? 'unavailable'),
  };
}

function maxDepth(sessions) {
  if (sessions.length === 0) {
    return 0;
  }
  return Math.max(...sessions.map((session) => session.depth ?? 0));
}

function countBy(sessions, getKey) {
  const counts = new Map();
  for (const session of sessions) {
    const key = getKey(session);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}
