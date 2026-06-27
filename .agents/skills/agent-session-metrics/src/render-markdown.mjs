export function renderMarkdown(report) {
  const lines = [
    '# Agent Session Metrics',
    '',
    `Provider: ${report.provider}`,
    `Target: \`${report.target.sessionId}\``,
    `Scope: ${report.scope}`,
    `Sessions: ${report.aggregate.sessionCount}`,
    `Duration: ${formatDuration(report.aggregate.durationMs)}`,
    `Tokens: ${formatTokens(report.aggregate.tokenUsage?.totalTokens)} total`,
    '',
    '| Session | Parent | Provider | Role | Nickname | Model / effort | Duration | Tokens |',
    '|---|---|---|---|---|---|---|---|',
    ...report.sessions.map(renderSessionRow),
  ];

  if (report.warnings.length > 0) {
    lines.push('', '## Warnings', ...report.warnings.map((warning) => `- ${warning}`));
  }

  return `${lines.join('\n')}\n`;
}

function renderSessionRow(session) {
  return [
    code(session.sessionId),
    session.parentSessionId ? code(session.parentSessionId) : '-',
    session.provider,
    session.agentRole ?? '-',
    session.agentNickname ?? '-',
    `${session.model ? code(session.model) : '-'} / ${session.effort ? code(session.effort) : '-'}`,
    formatDuration(session.durationMs),
    formatTokens(session.tokenUsage?.total?.totalTokens),
  ]
    .join(' | ')
    .replace(/^/u, '| ')
    .replace(/$/u, ' |');
}

function code(value) {
  return `\`${value}\``;
}

function formatDuration(durationMs) {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) {
    return 'unavailable';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatTokens(totalTokens) {
  return typeof totalTokens === 'number' && Number.isFinite(totalTokens)
    ? totalTokens.toLocaleString('en-US')
    : 'unavailable';
}
