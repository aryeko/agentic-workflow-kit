import path from 'node:path';
import {
  extractTableRows,
  hasStoryTableMarkers,
  normalizeHeader,
  normalizeOwner,
  parseDependencies,
  readOptionalCell,
  slash,
  stripMarkdown,
} from './markdownParser.js';
import {
  CONTRACT_COLUMNS,
  type ColumnIndexes,
  type ParsedRow,
  type TableRow,
  type TrackerDiagnostic,
  type TrackerValidationReport,
  UNOWNED_MARKERS,
  type ValidateTrackerMarkdownContext,
} from './trackerTypes.js';

export function validateTrackerMarkdown(
  markdown: string,
  context: ValidateTrackerMarkdownContext,
): TrackerValidationReport {
  const diagnostics: TrackerDiagnostic[] = [];
  const tableRows = safeExtractTableRows(markdown, context.trackerPath, diagnostics);
  let columns: ColumnIndexes | null = null;
  let currentTable = -1;
  let sawPotentialMatrix = false;
  const ids = new Map<string, number>();
  const rows: ParsedRow[] = [];
  const vocabulary = new Set(context.statusVocabulary.map((status) => status.toLowerCase()));

  for (const tableRow of tableRows) {
    if (tableRow.tableIndex !== currentTable) {
      columns = null;
      currentTable = tableRow.tableIndex;
    }

    const header = tryReadHeader(tableRow.cells);
    if (header) {
      if (!header.valid) {
        diagnostics.push({
          code: 'MISSING_CONTRACT_COLUMNS',
          severity: 'error',
          message: `${context.trackerPath} must contain the contract status matrix columns`,
          line: tableRow.line,
        });
        columns = null;
      } else {
        columns = header.columns;
      }
      sawPotentialMatrix = false;
      continue;
    }

    if (hasStoryTableMarkers(tableRow.cells)) {
      sawPotentialMatrix = true;
    }

    if (!columns) continue;

    const row = validateStoryRow(tableRow, columns, context, vocabulary, ids, diagnostics);
    if (row) rows.push(row);
  }

  if (rows.length === 0 && sawPotentialMatrix) {
    diagnostics.push({
      code: 'MISSING_CONTRACT_COLUMNS',
      severity: 'error',
      message: `${context.trackerPath} must contain the contract status matrix columns`,
    });
  }

  const knownIds = new Set(rows.map((row) => row.id));
  for (const row of rows) {
    for (const dependency of row.dependencies) {
      if (!knownIds.has(dependency)) {
        diagnostics.push({
          code: 'DEPENDENCY_UNKNOWN',
          severity: 'error',
          message: `${row.id} depends on unknown story ${dependency}`,
          line: row.order,
          storyId: row.id,
          sourceValue: dependency,
        });
      }
    }
  }

  return validationReport(context.trackerPath, rows.length, diagnostics);
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

function validationReport(
  trackerPath: string,
  storyCount: number,
  diagnostics: TrackerDiagnostic[],
): TrackerValidationReport {
  const errorCount = diagnostics.filter((entry) => entry.severity === 'error').length;
  return {
    ok: errorCount === 0,
    trackerPath,
    diagnostics,
    summary: {
      storyCount,
      errorCount,
      warningCount: diagnostics.length - errorCount,
    },
  };
}

function validateStoryRow(
  tableRow: TableRow,
  columns: ColumnIndexes,
  context: ValidateTrackerMarkdownContext,
  vocabulary: Set<string>,
  ids: Map<string, number>,
  diagnostics: TrackerDiagnostic[],
): ParsedRow | null {
  const id = stripMarkdown(tableRow.cells[columns.id]);
  const storyId = context.idPattern.test(id) ? id : undefined;
  if (!storyId) {
    diagnostics.push({
      code: 'STORY_ID_INVALID',
      severity: 'error',
      message: `Invalid story id ${id}. Expected ${context.idPattern.source}.`,
      line: tableRow.line,
      sourceValue: id,
    });
  } else {
    if (ids.has(storyId)) {
      diagnostics.push({
        code: 'STORY_ID_DUPLICATE',
        severity: 'error',
        message: `Duplicate story id ${storyId}. First seen at line ${ids.get(storyId)}.`,
        line: tableRow.line,
        storyId,
        sourceValue: storyId,
      });
    } else {
      ids.set(storyId, tableRow.line);
    }
    if (context.expectedIdPrefix && !storyId.startsWith(context.expectedIdPrefix)) {
      diagnostics.push({
        code: 'ID_PREFIX_MISMATCH',
        severity: 'error',
        message: `${storyId} does not use expected prefix ${context.expectedIdPrefix}.`,
        line: tableRow.line,
        storyId,
        sourceValue: storyId,
      });
    }
  }

  const status = stripMarkdown(tableRow.cells[columns.status]).toLowerCase();
  if (!vocabulary.has(status)) {
    diagnostics.push({
      code: 'STATUS_INVALID',
      severity: 'error',
      message: `${storyId ?? id} uses invalid status ${status}.`,
      line: tableRow.line,
      storyId,
      sourceValue: status,
    });
  }

  const parsedDependencies = parseDependencies(tableRow.cells[columns.dependencies], context.idPattern);
  for (const invalidDependency of parsedDependencies.invalidDependencies) {
    diagnostics.push({
      code: 'DEPENDENCY_TOKEN_INVALID',
      severity: 'error',
      message: `${storyId ?? id} has invalid dependency token ${invalidDependency}.`,
      line: tableRow.line,
      storyId,
      sourceValue: invalidDependency,
    });
  }

  const owner = normalizeOwner(readOptionalCell(tableRow.cells, columns.owner) ?? '');
  if (owner !== null && status !== 'implementing') {
    diagnostics.push({
      code: 'OWNER_CONFLICT',
      severity: 'warning',
      message: `${storyId ?? id} has owner ${owner} while status is ${status}.`,
      line: tableRow.line,
      storyId,
      sourceValue: owner,
    });
  }

  const spec = readOptionalCell(tableRow.rawCells, columns.spec);
  if (isMissingStoryBrief(spec, storyId, context)) {
    diagnostics.push({
      code: 'STORY_BRIEF_MISSING',
      severity: 'warning',
      message: `${storyId ?? id} is missing a story brief link.`,
      line: tableRow.line,
      storyId,
      sourceValue: spec,
    });
  }

  if (!storyId) return null;
  return {
    order: tableRow.line,
    id: storyId,
    title: stripMarkdown(tableRow.cells[columns.title]),
    dependencies: parsedDependencies.dependencies,
    invalidDependencies: parsedDependencies.invalidDependencies,
    wave: readOptionalCell(tableRow.cells, columns.wave),
    status,
    spec,
    plan: readOptionalCell(tableRow.rawCells, columns.plan),
    owner,
    pr: readOptionalCell(tableRow.rawCells, columns.pr),
  };
}

function isMissingStoryBrief(
  spec: string | undefined,
  storyId: string | undefined,
  context: ValidateTrackerMarkdownContext,
): boolean {
  if (!storyId) return false;
  if (!spec || UNOWNED_MARKERS.has(stripMarkdown(spec))) return true;
  if (!context.storyBriefBaseDir || !context.existingStoryBriefs) return false;
  const link = spec.match(/\(([^)]+)\)/)?.[1];
  if (!link) return true;
  const resolved = slash(path.normalize(path.join(path.dirname(context.trackerPath), link)));
  return !context.existingStoryBriefs.has(resolved);
}

function tryReadHeader(cells: string[]): { valid: false } | { valid: true; columns: ColumnIndexes } | null {
  const normalized = cells.map((cell) => normalizeHeader(cell));
  if (!normalized.includes('id') || !normalized.includes('status')) {
    return null;
  }
  if (
    normalized.length < CONTRACT_COLUMNS.length ||
    !CONTRACT_COLUMNS.every((column, index) => normalized[index] === column)
  ) {
    return { valid: false };
  }
  return {
    valid: true,
    columns: {
      id: 0,
      title: 1,
      dependencies: 2,
      wave: 3,
      status: 4,
      spec: 5,
      plan: 6,
      owner: 7,
      pr: 8,
    },
  };
}
