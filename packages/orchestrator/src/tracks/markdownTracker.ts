import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { glob } from 'tinyglobby';
import { isNodeError } from '../internal/guards.js';
import type { StorySource, WorkflowStory, WorkflowTrack } from '../types.js';
import { normalizeOwner, parseTrackerStories, stripMarkdown } from './markdownParser.js';
import type { DiscoverMarkdownTracksOptions } from './trackerTypes.js';

export { parseTrackerStories, updateTrackerStoryRow } from './markdownParser.js';
export { migrateMarkdownTracker } from './trackerMigration.js';
export type {
  MigrateMarkdownTrackerContext,
  ParseTrackerStoriesContext,
  TrackerDiagnostic,
  TrackerMigrationReport,
  TrackerMigrationResult,
  TrackerValidationReport,
  ValidateTrackerMarkdownContext,
} from './trackerTypes.js';
export { validateTrackerMarkdown } from './trackerValidation.js';

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
    const rawStories = parseTrackerStories(markdown, {
      completeStatuses: new Set(options.completeStatuses),
      eligibleStatuses: new Set(options.eligibleStatuses),
      idPattern: new RegExp(options.idPattern),
      trackId,
      trackTitle: title,
      trackerPath: relativePath,
    });
    const stories = await enrichStoryKinds(rawStories, path.dirname(readmePath));

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

async function findReadmes(root: string): Promise<string[]> {
  try {
    return await glob('**/README.md', { cwd: root, absolute: true, caseSensitiveMatch: false });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }
}

function parseFrontmatter(markdown: string): { title?: string; status?: string; owner?: string } {
  const { data } = matter(markdown);
  const pick = (value: unknown): string | undefined => (typeof value === 'string' ? value.trim() : undefined);
  return { title: pick(data.title), status: pick(data.status), owner: pick(data.owner) };
}

/**
 * Read each story's spec-linked file and pull the `kind` field from its
 * YAML frontmatter. When `kind: promote` is found, force `eligible = false`
 * and set a clear `blockedReason` so every runtime consumer (run-eligible,
 * scheduler, facade, CLI) skips it automatically.
 *
 * Seam: this runs in the disk-loading layer where the tracker directory path
 * is available. The pure `parseTrackerStories` parser is kept free of fs I/O.
 *
 * Missing or unreadable spec files are silently ignored — the story retains
 * whatever eligibility the matrix computed.
 */
async function enrichStoryKinds(stories: WorkflowStory[], trackerDir: string): Promise<WorkflowStory[]> {
  return Promise.all(
    stories.map(async (story) => {
      const specCell = story.metadata.spec;
      if (!specCell) return story;

      // Extract the href from a Markdown link such as [story](./stories/LK04.md)
      const hrefMatch = specCell.match(/\]\(([^)]+)\)/);
      const href = hrefMatch ? hrefMatch[1].trim() : stripMarkdown(specCell).trim();
      if (!href) return story;

      const specPath = path.resolve(trackerDir, href);
      let content: string;
      try {
        content = await readFile(specPath, 'utf8');
      } catch {
        // Missing or unreadable spec file — leave story unchanged.
        return story;
      }

      const { data } = matter(content);
      if (data.kind !== 'promote') return story;

      return {
        ...story,
        kind: 'promote' as const,
        eligible: false,
        blockedReason: 'terminal promote story — run /promote-to-canonical',
      };
    }),
  );
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

function isPathUnder(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function slash(value: string): string {
  return value.split(path.sep).join('/');
}
