import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { toString as mdastToString } from 'mdast-util-to-string';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { glob } from 'tinyglobby';

import { isNodeError } from '../internal/guards.js';
import type { StorySource, WorkflowStory, WorkflowTrack } from '../types.js';

const UNOWNED_MARKERS = new Set(['', '—', '-']);
const CONTRACT_COLUMNS = ['id', 'name', 'depends on', 'wave', 'status', 'spec', 'plan', 'owner', 'pr'];

export interface DiscoverMarkdownTracksOptions {
  workspaceRoot: string;
  tracksDir: string;
  archiveDir: string;
  completeStatuses: string[];
  eligibleStatuses: string[];
  idPattern: string;
}

export interface ParseTrackerStoriesContext {
  completeStatuses: Set<string>;
  eligibleStatuses: Set<string>;
  idPattern: RegExp;
  trackId: string;
  trackTitle: string;
  trackerPath: string;
}

export class MarkdownTrackStorySource implements StorySource {
  constructor(
    private readonly options: DiscoverMarkdownTracksOptions,
    private readonly trackId: string,
  ) {}

  async listStories(): Promise<WorkflowStory[]> {
    const tracks = await discoverMarkdownTracks(this.options);
    const track = tracks.find((entry) => entry.id === this.trackId);
    if (!track) throw new Error(`track ${this.trackId} was not found`);
    return track.stories;
  }
}

export class EmptyStorySource implements StorySource {
  async listStories(): Promise<WorkflowStory[]> {
    return [];
  }
}

export async function discoverMarkdownTracks(options: DiscoverMarkdownTracksOptions): Promise<WorkflowTrack[]> {
  const tracksRoot = path.resolve(options.workspaceRoot, options.tracksDir);
  const archiveRoot = path.resolve(options.workspaceRoot, options.archiveDir);
  const readmes = await findReadmes(tracksRoot);
  const tracks: WorkflowTrack[] = [];

  for (const readmePath of readmes) {
    if (isPathUnder(readmePath, archiveRoot)) {
      continue;
    }

    const markdown = await readFile(readmePath, 'utf8');
    const frontmatter = parseFrontmatter(markdown);
    if (frontmatter.status === 'archived') {
      continue;
    }

    const relativePath = slash(path.relative(options.workspaceRoot, readmePath));
    const trackId = trackIdFromPath(tracksRoot, readmePath);
    const title = frontmatter.title ?? titleFromTrackId(trackId);
    const stories = parseTrackerStories(markdown, {
      completeStatuses: new Set(options.completeStatuses),
      eligibleStatuses: new Set(options.eligibleStatuses),
      idPattern: new RegExp(options.idPattern),
      trackId,
      trackTitle: title,
      trackerPath: relativePath,
    });

    if (stories.length === 0) continue;

    tracks.push({
      id: trackId,
      title,
      relativePath,
      pathAbs: readmePath,
      status: frontmatter.status,
      owner: normalizeOwner(frontmatter.owner ?? ''),
      stories,
    });
  }

  return tracks.sort((left, right) => left.id.localeCompare(right.id));
}

export function parseTrackerStories(markdown: string, context: ParseTrackerStoriesContext): WorkflowStory[] {
  const rows = parseRows(markdown, context.trackerPath, context.idPattern);
  validateUniqueStoryIds(rows, context.trackerPath);
  const statusById = new Map(rows.map((row) => [row.id, row.status]));

  return rows.map((row) => {
    const blockedReason = blockedReasonFor(row, statusById, context.completeStatuses, context.eligibleStatuses);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      owner: row.owner,
      dependencies: row.dependencies,
      eligible: blockedReason === null,
      blockedReason,
      metadata: {
        trackId: context.trackId,
        trackTitle: context.trackTitle,
        trackerPath: context.trackerPath,
        order: row.order,
        wave: row.wave,
        spec: row.spec,
        plan: row.plan,
        pr: row.pr,
        invalidDependencies: row.invalidDependencies.length > 0 ? row.invalidDependencies : undefined,
      },
    };
  });
}

export function updateTrackerStoryRow(
  markdown: string,
  context: Pick<ParseTrackerStoriesContext, 'idPattern' | 'trackerPath'>,
  storyId: string,
  updates: { status?: string; owner?: string },
): string {
  const lines = markdown.split(/\r?\n/);
  const tableRows = extractTableRows(markdown, context.trackerPath);
  let columns: ColumnIndexes | null = null;
  let currentTable = -1;

  for (const tableRow of tableRows) {
    if (tableRow.tableIndex !== currentTable) {
      columns = null;
      currentTable = tableRow.tableIndex;
    }

    const header = readHeader(tableRow.cells, context.trackerPath);
    if (header) {
      columns = header;
      continue;
    }

    if (!columns) continue;
    const id = stripMarkdown(tableRow.cells[columns.id]);
    if (id !== storyId) continue;
    if (!context.idPattern.test(id)) {
      throw new Error(`invalid story id ${id} in ${context.trackerPath} at line ${tableRow.line}`);
    }

    const cells = [...tableRow.rawCells];
    if (updates.status !== undefined) cells[columns.status] = updates.status;
    if (updates.owner !== undefined) cells[columns.owner] = updates.owner;
    lines[tableRow.line - 1] = renderTableRow(cells);
    return lines.join('\n');
  }

  throw new Error(`story ${storyId} was not found in ${context.trackerPath}`);
}

interface ParsedRow {
  order: number;
  id: string;
  title: string;
  dependencies: string[];
  invalidDependencies: string[];
  status: string;
  owner: string | null;
  wave?: string;
  spec?: string;
  plan?: string;
  pr?: string;
}

interface ColumnIndexes {
  id: number;
  title: number;
  dependencies: number;
  wave: number;
  status: number;
  spec: number;
  plan: number;
  owner: number;
  pr: number;
}

async function findReadmes(root: string): Promise<string[]> {
  try {
    return await glob('**/README.md', { cwd: root, absolute: true, caseSensitiveMatch: false });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }
}

function parseRows(markdown: string, trackerPath: string, idPattern: RegExp): ParsedRow[] {
  const tableRows = extractTableRows(markdown, trackerPath);
  const rows: ParsedRow[] = [];
  let columns: ColumnIndexes | null = null;
  let sawPotentialMatrix = false;
  let currentTable = -1;

  for (const tableRow of tableRows) {
    if (tableRow.tableIndex !== currentTable) {
      columns = null;
      currentTable = tableRow.tableIndex;
    }

    const header = readHeader(tableRow.cells, trackerPath);
    if (header) {
      columns = header;
      sawPotentialMatrix = false;
      continue;
    }

    if (hasStoryTableMarkers(tableRow.cells)) {
      sawPotentialMatrix = true;
    }

    if (!columns) {
      continue;
    }

    const row = parseStoryRow(tableRow, columns, idPattern, trackerPath);
    if (row) rows.push(row);
  }

  if (rows.length === 0 && sawPotentialMatrix) {
    throw new Error(`${trackerPath} must contain the contract status matrix columns`);
  }

  return rows;
}

function parseStoryRow(
  tableRow: TableRow,
  columns: ColumnIndexes,
  idPattern: RegExp,
  trackerPath: string,
): ParsedRow | null {
  const { cells, rawCells, line } = tableRow;
  const id = stripMarkdown(cells[columns.id]);
  if (!idPattern.test(id)) {
    throw new Error(`invalid story id ${id} in ${trackerPath} at line ${line}`);
  }
  const parsedDependencies = parseDependencies(cells[columns.dependencies], idPattern);

  return {
    order: line,
    id,
    title: stripMarkdown(cells[columns.title]),
    dependencies: parsedDependencies.dependencies,
    invalidDependencies: parsedDependencies.invalidDependencies,
    wave: readOptionalCell(cells, columns.wave),
    status: stripMarkdown(cells[columns.status]).toLowerCase(),
    spec: readOptionalCell(rawCells, columns.spec),
    plan: readOptionalCell(rawCells, columns.plan),
    owner: normalizeOwner(readOptionalCell(cells, columns.owner) ?? ''),
    pr: readOptionalCell(rawCells, columns.pr),
  };
}

function readHeader(cells: string[], trackerPath: string): ColumnIndexes | null {
  const normalized = cells.map((cell) => normalizeHeader(cell));
  if (!normalized.includes('id') || !normalized.includes('status')) {
    return null;
  }

  if (
    normalized.length < CONTRACT_COLUMNS.length ||
    !CONTRACT_COLUMNS.every((column, index) => normalized[index] === column)
  ) {
    throw new Error(`${trackerPath} must contain the contract status matrix columns`);
  }

  return {
    id: 0,
    title: 1,
    dependencies: 2,
    wave: 3,
    status: 4,
    spec: 5,
    plan: 6,
    owner: 7,
    pr: 8,
  };
}

function blockedReasonFor(
  row: ParsedRow,
  statusById: Map<string, string>,
  completeStatuses: Set<string>,
  eligibleStatuses: Set<string>,
): string | null {
  if (!eligibleStatuses.has(row.status)) return `status is ${row.status}`;
  if (row.owner !== null) return `owner is ${row.owner}`;
  if (row.invalidDependencies.length > 0) {
    return `dependencies could not be parsed: ${row.invalidDependencies.join(', ')}`;
  }

  const incomplete = row.dependencies.filter((dependency) => !completeStatuses.has(statusById.get(dependency) ?? ''));
  if (incomplete.length > 0) return `dependencies are not complete: ${incomplete.join(', ')}`;

  return null;
}

function parseDependencies(
  value: string,
  idPattern: RegExp,
): { dependencies: string[]; invalidDependencies: string[] } {
  const clean = stripMarkdown(value);
  if (UNOWNED_MARKERS.has(clean)) return { dependencies: [], invalidDependencies: [] };
  const dependencies: string[] = [];
  const invalidDependencies: string[] = [];
  for (const token of clean
    .split(/[,;/]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    if (idPattern.test(token)) {
      dependencies.push(token);
    } else {
      invalidDependencies.push(token);
    }
  }
  return { dependencies, invalidDependencies };
}

function normalizeOwner(value: string): string | null {
  const owner = stripMarkdown(value);
  return UNOWNED_MARKERS.has(owner) ? null : owner;
}

function readOptionalCell(cells: string[], index: number): string | undefined {
  return cells[index]?.trim();
}

function parseFrontmatter(markdown: string): { title?: string; status?: string; owner?: string } {
  const { data } = matter(markdown);
  const pick = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim() : undefined);
  return { title: pick(data.title), status: pick(data.status), owner: pick(data.owner) };
}

function validateUniqueStoryIds(rows: ParsedRow[], trackerPath: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) throw new Error(`duplicate story id ${row.id} in ${trackerPath}`);
    seen.add(row.id);
  }
}

function trackIdFromPath(tracksRoot: string, readmePath: string): string {
  const relativeDir = slash(path.relative(tracksRoot, path.dirname(readmePath)));
  return relativeDir === '' ? 'root' : relativeDir;
}

function titleFromTrackId(trackId: string): string {
  return trackId
    .split(/[/-]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripMarkdown(value: string | undefined): string {
  return (value ?? '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .trim();
}

interface MarkdownNode {
  type?: string;
  children?: MarkdownNode[];
  position?: {
    start?: {
      line?: number;
    };
    end?: {
      line?: number;
    };
  };
}

interface TableRow {
  tableIndex: number;
  line: number;
  cells: string[];
  rawCells: string[];
}

interface TableRange {
  start: number;
  end: number;
}

function extractTableRows(markdown: string, trackerPath: string): TableRow[] {
  const lines = markdown.split(/\r?\n/);
  const tree = remark().use(remarkGfm).parse(markdown) as MarkdownNode;
  const rows: TableRow[] = [];
  const tableRanges: TableRange[] = [];
  let tableIndex = 0;

  visitTables(tree, (table) => {
    const start = table.position?.start?.line ?? 0;
    const end = table.position?.end?.line ?? start;
    tableRanges.push({ start, end });
    for (const row of table.children ?? []) {
      const line = row.position?.start?.line ?? 0;
      rows.push({
        tableIndex,
        line,
        // mdast-util-to-string intentionally strips all inline constructs from parsed story fields.
        cells: (row.children ?? []).map((cell) => mdastToString(cell).trim()),
        rawCells: parseRawTableCells(lines[line - 1] ?? ''),
      });
    }
    tableIndex += 1;
  });

  assertNoUnparsedIndentedTables(lines, tableRanges, trackerPath);

  return rows;
}

function visitTables(node: MarkdownNode, visitor: (table: MarkdownNode) => void): void {
  if (node.type === 'table') {
    visitor(node);
    return;
  }
  for (const child of node.children ?? []) {
    visitTables(child, visitor);
  }
}

function parseRawTableCells(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells: string[] = [];
  let cell = '';

  for (let index = 1; index < trimmed.length - 1; index += 1) {
    const char = trimmed[index];
    const next = trimmed[index + 1];
    if (char === '\\' && next === '|') {
      cell += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }
    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function renderTableRow(cells: string[]): string {
  return `| ${cells.map(escapeTableCell).join(' | ')} |`;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function assertNoUnparsedIndentedTables(lines: string[], tableRanges: TableRange[], trackerPath: string): void {
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (isLineInParsedTable(lineNumber, tableRanges)) return;
    if (!hasLeadingWhitespace(line)) return;
    if (!looksLikeGfmTableStart(line, lines[index + 1] ?? '')) return;
    throw new Error(`Tracker table at ${trackerPath}:${lineNumber} is indented; GFM tables must start at column 0`);
  });
}

function isLineInParsedTable(lineNumber: number, tableRanges: TableRange[]): boolean {
  return tableRanges.some((range) => lineNumber >= range.start && lineNumber <= range.end);
}

function hasLeadingWhitespace(line: string): boolean {
  return /^\s+\|/.test(line);
}

function looksLikeGfmTableStart(headerLine: string, delimiterLine: string): boolean {
  return isPipeTableLine(headerLine.trim()) && isGfmDelimiterLine(delimiterLine.trim());
}

function isPipeTableLine(line: string): boolean {
  return /^\|.*\|$/.test(line);
}

function isGfmDelimiterLine(line: string): boolean {
  return /^\|(\s*:?-+:?\s*\|)+$/.test(line);
}

function normalizeHeader(value: string): string {
  return stripMarkdown(value).toLowerCase();
}

function hasStoryTableMarkers(cells: string[]): boolean {
  const normalized = cells.map((cell) => normalizeHeader(cell));
  return normalized.includes('id') && (normalized.includes('status') || normalized.includes('name'));
}

function isPathUnder(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slash(value: string): string {
  return value.split(path.sep).join('/');
}
