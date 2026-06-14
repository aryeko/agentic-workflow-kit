import type { WorkflowRunAnalysis } from './runAnalyzer.js';

export function buildWorkflowRunReportMarkdown(analysis: WorkflowRunAnalysis, artifactDir: string): string {
  const lines: string[] = [];
  lines.push(`# WorkflowKit run report: ${analysis.runId}`);
  lines.push('');
  lines.push('## Outcome');
  lines.push('');
  lines.push(`- Status: ${analysis.status}`);
  lines.push(`- Derived status: ${analysis.derivedStatus}`);
  lines.push(`- Blocked reason: ${analysis.blockedReason ?? 'None'}`);
  lines.push(`- Artifact directory: ${artifactDir}`);
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  pushList(lines, analysis.issues);
  lines.push('');
  lines.push('## Children');
  lines.push('');
  if (analysis.children.length === 0) {
    lines.push('None');
  } else {
    lines.push('| Story | Status | OK | Session | Metrics | Worktree |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const child of analysis.children) {
      lines.push(
        `| ${child.storyId} | ${child.status} | ${formatNullable(child.ok)} | ${formatSession(child)} | ${
          child.metricsStatus
        } | ${child.expectedWorktreePath ?? 'n/a'} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  if (analysis.verification.commands.length === 0) {
    lines.push('None');
  } else {
    for (const command of analysis.verification.commands) {
      lines.push(
        `- ${command.status}: ${command.command ?? 'unknown command'} (${command.phase ?? 'unknown phase'}${
          command.eventAt ? `, ${command.eventAt}` : ''
        })`,
      );
    }
  }
  lines.push('');
  lines.push('## Review');
  lines.push('');
  lines.push(`- Pre-PR status: ${analysis.review.prePr.status}`);
  lines.push(`- Pre-PR requested mode: ${analysis.review.prePr.requestedMode ?? 'n/a'}`);
  lines.push(`- Pre-PR actual mode: ${analysis.review.prePr.actualMode ?? 'n/a'}`);
  lines.push(`- Pre-PR fix batches: ${analysis.review.prePr.fixBatchCount}`);
  lines.push(`- PR findings: ${analysis.review.pr.findings.length}`);
  lines.push(`- PR fix batches: ${analysis.review.pr.fixBatchCount}`);
  if (analysis.review.prePr.loops.length > 0) {
    lines.push('');
    lines.push('| Loop | Mode | Status | Findings | Agent | Continuity |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const loop of analysis.review.prePr.loops) {
      lines.push(
        `| ${loop.loop ?? 'n/a'} | ${loop.mode ?? 'n/a'} | ${loop.status} | ${loop.findings ?? 'n/a'} | ${
          loop.agentId ?? 'n/a'
        } | ${loop.continuityMode ?? 'n/a'} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Merge');
  lines.push('');
  lines.push(`- Merged: ${analysis.merge.merged}`);
  lines.push(`- Merged at: ${analysis.merge.mergedAt ?? 'n/a'}`);
  lines.push(`- Cleanup status: ${analysis.merge.cleanupStatus ?? 'n/a'}`);
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push(`- Commands: ${formatRecord(analysis.commandCounts)}`);
  lines.push(`- Subagents: ${formatRecord(analysis.subagentCounts)}`);
  lines.push(`- Tokens: ${analysis.tokenTotals ? formatRecord(analysis.tokenTotals) : 'unavailable'}`);
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- summary.json: ${formatArtifactPresence(analysis.artifacts.summary)}`);
  lines.push(`- rows.json: ${analysis.artifacts.rows.present ? `${analysis.artifacts.rows.count} rows` : 'missing'}`);
  lines.push(
    `- budgets.json: ${
      analysis.artifacts.budgets.present ? `${analysis.artifacts.budgets.evaluationCount} evaluations` : 'missing'
    }`,
  );
  lines.push(
    `- transcripts.json: ${
      analysis.artifacts.transcripts.present
        ? `${analysis.artifacts.transcripts.linked} linked, ${analysis.artifacts.transcripts.missing} missing, ${analysis.artifacts.transcripts.unlinked} unlinked`
        : 'missing'
    }`,
  );
  lines.push('');
  lines.push('## Transcript Links');
  lines.push('');
  lines.push(`Transcript artifacts are path-only. This report does not copy or inline host transcript content.`);
  return `${lines.join('\n')}\n`;
}

function pushList(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push('None');
    return;
  }
  for (const value of values) lines.push(`- ${value}`);
}

function formatNullable(value: boolean | null): string {
  return value === null ? 'n/a' : String(value);
}

function formatSession(child: WorkflowRunAnalysis['children'][number]): string {
  if (child.sessionId) return child.sessionId;
  if (child.sessionLogPath) return child.sessionLogPath;
  return child.linkageStatus;
}

function formatRecord(value: object): string {
  const entries = Object.entries(value);
  if (entries.length === 0) return 'none';
  return entries.map(([key, entry]) => `${key}=${String(entry)}`).join(', ');
}

function formatArtifactPresence(value: { present: boolean; schemaVersion: number | null }): string {
  if (!value.present) return 'missing';
  return `present${value.schemaVersion === null ? '' : `, schemaVersion ${value.schemaVersion}`}`;
}
