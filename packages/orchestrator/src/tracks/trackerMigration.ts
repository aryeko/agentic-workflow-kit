import { extractTableRows, normalizeHeader, normalizeOwner, renderTableRow, stripMarkdown } from './markdownParser.js';
import {
  CONTRACT_COLUMNS,
  type MigrateMarkdownTrackerContext,
  type TableRow,
  type TrackerDiagnostic,
  type TrackerMigrationResult,
  UNOWNED_MARKERS,
} from './trackerTypes.js';

export function migrateMarkdownTracker(
  markdown: string,
  context: MigrateMarkdownTrackerContext,
): TrackerMigrationResult {
  const diagnostics: TrackerDiagnostic[] = [];
  const tableRows = safeExtractTableRows(markdown, `${context.trackId}:source`, diagnostics);
  const source = firstMigrationTable(tableRows);
  const sourceRows = source?.rows ?? [];
  const rows: string[][] = [];
  const idMap = new Map<string, string>();
  const usedIds = new Set<string>();

  if (!source) {
    diagnostics.push({
      code: 'SOURCE_TABLE_MISSING',
      severity: 'error',
      message: 'No markdown table was found to migrate.',
    });
  }

  const sourceColumns = source?.columns ?? new Map<string, number>();
  for (const sourceRow of sourceRows) {
    const rawId = readByAliases(sourceRow.cells, sourceColumns, ['id', 'key', 'story', 'issue']) ?? '';
    const title = readByAliases(sourceRow.cells, sourceColumns, ['name', 'title', 'summary']) ?? rawId;
    const rawDeps = readByAliases(sourceRow.cells, sourceColumns, ['depends on', 'dependencies', 'blocked by']) ?? '—';
    const wave = readByAliases(sourceRow.cells, sourceColumns, ['wave', 'phase', 'milestone']) ?? 'W1';
    const rawStatus = readByAliases(sourceRow.cells, sourceColumns, ['status', 'state']) ?? 'specced';
    const owner = readByAliases(sourceRow.cells, sourceColumns, ['owner', 'assignee']) ?? '—';
    const normalizedId = uniqueMigratedId(normalizeMigratedId(rawId, context), usedIds);
    usedIds.add(normalizedId);
    idMap.set(stripMarkdown(rawId), normalizedId);
    if (stripMarkdown(rawId) !== normalizedId) {
      diagnostics.push({
        code: 'ID_NORMALIZED',
        severity: 'warning',
        message: `Normalized source id ${stripMarkdown(rawId)} to ${normalizedId}.`,
        line: sourceRow.line,
        storyId: normalizedId,
        sourceValue: stripMarkdown(rawId),
      });
    }

    const status = normalizeMigratedStatus(rawStatus, context);
    if (stripMarkdown(rawStatus).toLowerCase() !== status) {
      diagnostics.push({
        code: 'STATUS_MAPPED',
        severity: 'warning',
        message: `Mapped source status ${stripMarkdown(rawStatus)} to ${status}.`,
        line: sourceRow.line,
        storyId: normalizedId,
        sourceValue: stripMarkdown(rawStatus),
      });
    }

    const dependencies = migrateDependencyCell(rawDeps, idMap, context);
    rows.push([
      normalizedId,
      stripMarkdown(title),
      dependencies.length === 0 ? '—' : dependencies.join(', '),
      stripMarkdown(wave) || 'W1',
      status,
      `[brief](./stories/${normalizedId}.md)`,
      '—',
      normalizeOwner(owner) ?? '—',
      '—',
    ]);
  }

  const draftMarkdown = renderDraftTracker(context, rows);
  const errorCount = diagnostics.filter((entry) => entry.severity === 'error').length;
  const warningCount = diagnostics.length - errorCount;
  return {
    draftMarkdown,
    report: {
      ok: errorCount === 0,
      trackId: context.trackId,
      diagnostics,
      summary: {
        sourceRows: sourceRows.length,
        importedRows: rows.length,
        generatedStoryBriefCount: rows.length,
        errorCount,
        warningCount,
      },
    },
  };
}

function firstMigrationTable(tableRows: TableRow[]): { columns: Map<string, number>; rows: TableRow[] } | null {
  let currentTable = -1;
  let columns: Map<string, number> | null = null;
  const rows: TableRow[] = [];

  for (const tableRow of tableRows) {
    if (tableRow.tableIndex !== currentTable) {
      if (columns && rows.length > 0) return { columns, rows };
      currentTable = tableRow.tableIndex;
      columns = null;
      rows.length = 0;
    }

    if (!columns) {
      columns = new Map(tableRow.cells.map((cell, index) => [normalizeHeader(cell), index]));
      continue;
    }
    rows.push(tableRow);
  }

  return columns && rows.length > 0 ? { columns, rows } : null;
}

function safeExtractTableRows(markdown: string, trackerPath: string, diagnostics: TrackerDiagnostic[]): TableRow[] {
  try {
    return extractTableRows(markdown, trackerPath);
  } catch (error) {
    diagnostics.push({
      code: 'TABLE_PARSE_ERROR',
      severity: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function readByAliases(cells: string[], columns: Map<string, number>, aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const index = columns.get(alias);
    if (index !== undefined) return cells[index];
  }
  return undefined;
}

function normalizeMigratedId(value: string, context: MigrateMarkdownTrackerContext): string {
  const clean = stripMarkdown(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (context.idPattern.test(clean)) return clean;
  const numeric = clean.match(/[0-9]+/)?.[0] ?? '1';
  return `${context.idPrefix}${numeric}`;
}

function uniqueMigratedId(id: string, usedIds: Set<string>): string {
  if (!usedIds.has(id)) return id;
  let suffix = 2;
  while (usedIds.has(`${id}${suffix}`)) suffix += 1;
  return `${id}${suffix}`;
}

function normalizeMigratedStatus(value: string, context: MigrateMarkdownTrackerContext): string {
  const clean = stripMarkdown(value).toLowerCase();
  const vocabulary = new Set(context.statusVocabulary);
  const firstAvailable = (...candidates: string[]) =>
    candidates.find((candidate) => vocabulary.has(candidate)) ?? context.statusVocabulary[0] ?? 'specced';
  if (clean === 'done' || clean === 'verified' || clean === 'complete' || clean === 'completed') {
    return firstAvailable(context.defaultCompleteStatus ?? 'done', 'verified');
  }
  if (clean === 'in progress' || clean === 'doing' || clean === 'implementing') {
    return firstAvailable(context.inProgressStatus ?? 'implementing');
  }
  if (clean === 'blocked') return firstAvailable('blocked');
  if (clean === 'deferred') return firstAvailable('deferred');
  if (clean === 'canceled' || clean === 'cancelled') return firstAvailable('canceled');
  if (clean === 'superseded') return firstAvailable('superseded');
  return firstAvailable(context.defaultEligibleStatus ?? 'specced', 'plan-approved');
}

function migrateDependencyCell(
  value: string,
  idMap: Map<string, string>,
  context: MigrateMarkdownTrackerContext,
): string[] {
  const clean = stripMarkdown(value);
  if (UNOWNED_MARKERS.has(clean)) return [];
  return clean
    .split(/[,;/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => idMap.get(entry) ?? normalizeMigratedId(entry, context));
}

function renderDraftTracker(context: MigrateMarkdownTrackerContext, rows: string[][]): string {
  const table = [
    renderTableRow(
      CONTRACT_COLUMNS.map((column) => column.replace(/^id$/, 'ID').replace(/\b\w/g, (char) => char.toUpperCase())),
    ),
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(renderTableRow),
  ].join('\n');
  return `---
title: ${context.trackTitle}
status: draft
owner: —
---

# ${context.trackTitle}

## Status matrix

${table}

## Dependency graph

\`\`\`mermaid
flowchart TD
\`\`\`

## Migration report

Review generated story briefs and validation diagnostics before execution.
`;
}
