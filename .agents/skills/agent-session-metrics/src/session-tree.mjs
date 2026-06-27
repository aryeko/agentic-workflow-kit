export function buildSessionTree({ rootSessionId, sessions }) {
  const byId = new Map(sessions.map((session) => [session.sessionId, session]));
  const childrenByParent = new Map();
  const warnings = [];

  for (const session of sessions) {
    if (!session.parentSessionId) {
      continue;
    }
    if (!byId.has(session.parentSessionId)) {
      continue;
    }
    const children = childrenByParent.get(session.parentSessionId) ?? [];
    childrenByParent.set(session.parentSessionId, [...children, session.sessionId].sort());
  }

  const nodes = [];
  const visited = new Set();
  function visit(sessionId) {
    if (visited.has(sessionId) || !byId.has(sessionId)) {
      return;
    }
    visited.add(sessionId);
    const session = byId.get(sessionId);
    const children = childrenByParent.get(sessionId) ?? [];
    nodes.push({
      provider: session.provider,
      sessionId,
      parentSessionId: session.parentSessionId,
      depth: session.depth,
      children,
    });
    for (const child of children) {
      visit(child);
    }
  }

  visit(rootSessionId);
  if (nodes.length === 0) {
    warnings.push(`Root session ${rootSessionId} was not found in parsed sessions`);
  }
  return { rootSessionId, nodes, warnings };
}

export function selectSessionsByScope({ sessions, tree, scope }) {
  const byId = new Map(sessions.map((session) => [session.sessionId, session]));
  const orderedIds = tree.nodes.map((node) => node.sessionId);
  const selectedIds =
    scope === 'main'
      ? [tree.rootSessionId]
      : scope === 'children'
        ? orderedIds.filter((sessionId) => sessionId !== tree.rootSessionId)
        : orderedIds;

  return selectedIds.map((sessionId) => byId.get(sessionId)).filter(Boolean);
}
