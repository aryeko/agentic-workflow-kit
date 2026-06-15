export const UNOWNED_MARKERS = new Set(['', '—', '-']);
export const CONTRACT_COLUMNS = ['id', 'name', 'depends on', 'wave', 'status', 'spec', 'plan', 'owner', 'pr'];

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

export interface ValidateTrackerMarkdownContext extends ParseTrackerStoriesContext {
  statusVocabulary: readonly string[];
  expectedIdPrefix?: string;
  storyBriefBaseDir?: string;
  existingStoryBriefs?: Set<string>;
}

export interface TrackerDiagnostic {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  storyId?: string;
  sourceValue?: string;
}

export interface TrackerValidationReport {
  ok: boolean;
  trackerPath: string;
  diagnostics: TrackerDiagnostic[];
  summary: {
    storyCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface MigrateMarkdownTrackerContext {
  trackId: string;
  trackTitle: string;
  idPrefix: string;
  idPattern: RegExp;
  statusVocabulary: readonly string[];
  defaultEligibleStatus?: string;
  defaultCompleteStatus?: string;
  inProgressStatus?: string;
}

export interface TrackerMigrationReport {
  ok: boolean;
  trackId: string;
  diagnostics: TrackerDiagnostic[];
  summary: {
    sourceRows: number;
    importedRows: number;
    generatedStoryBriefCount: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface TrackerMigrationResult {
  draftMarkdown: string;
  report: TrackerMigrationReport;
}

export interface ParsedRow {
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

export interface ColumnIndexes {
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

export interface TableRow {
  tableIndex: number;
  line: number;
  cells: string[];
  rawCells: string[];
}
