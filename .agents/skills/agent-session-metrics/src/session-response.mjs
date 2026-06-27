export function buildSessionResponse({ rootSessionId, sessions, tree, scope }) {
  const byId = new Map(sessions.map((session) => [session.sessionId, session]));
  const childrenById = new Map(tree.nodes.map((node) => [node.sessionId, node.children]));
  const root = byId.get(rootSessionId);

  if (!root) {
    return null;
  }

  return toResponseSession({
    session: root,
    byId,
    childrenById,
    includeChildren: scope !== 'main',
  });
}

export function flattenResponseSessions(session) {
  if (!session) {
    return [];
  }
  return [session, ...session.children.flatMap(flattenResponseSessions)];
}

function toResponseSession({ session, byId, childrenById, includeChildren }) {
  const warnings = session.warnings ?? [];
  return {
    id: session.sessionId,
    name: session.title ?? session.agentNickname ?? '',
    success: warnings.length === 0,
    ...(warnings.length > 0 ? { error: warnings.join('; ') } : {}),
    metrics: {
      durationMs: numberOrZero(session.durationMs),
      tokens: toResponseTokens(session.tokenUsage?.total),
      turns: session.counts?.turns ?? 0,
      toolsCalled: session.counts?.toolCalls ?? 0,
    },
    children: includeChildren
      ? (childrenById.get(session.sessionId) ?? [])
          .map((childId) => byId.get(childId))
          .filter(Boolean)
          .map((child) =>
            toResponseSession({
              session: child,
              byId,
              childrenById,
              includeChildren: true,
            }),
          )
      : [],
  };
}

function toResponseTokens(tokens) {
  return {
    in: tokens?.inputTokens ?? 0,
    out: tokens?.outputTokens ?? 0,
    cached: tokens?.cachedInputTokens ?? 0,
    total: tokens?.totalTokens ?? 0,
  };
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
