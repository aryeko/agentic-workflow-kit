import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  discoverMarkdownTracks,
  migrateMarkdownTracker,
  parseTrackerStories,
  validateTrackerMarkdown,
} from '../src/tracks/markdownTracker';

const trackerMarkdown = `---
title: Linkly tracker
status: approved
owner: —
---

# Linkly

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L001 | Foundation | — | 1 | done | [spec](../../specs/l001.md) | [plan](../../plans/l001.md) | — | — |
| L002 | Pilot | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |
| L003 | Claimed | L001 | 2 | specced | [spec](../../specs/l003.md) | — | arye | — |
| L004 | Waiting | L999 | 3 | specced | [spec](../../specs/l004.md) | — | — | — |

## Dependency graph

\`\`\`mermaid
flowchart TD
  L001 --> L002
\`\`\`

## Parallelism rules

Wave 2 can run after L001.
`;

function parseStories(markdown: string) {
  return parseTrackerStories(markdown, {
    completeStatuses: new Set(['done', 'verified']),
    eligibleStatuses: new Set(['specced', 'plan-approved']),
    idPattern: /^[A-Z]{1,}[0-9]+$/,
    trackId: 'linkly',
    trackTitle: 'Linkly tracker',
    trackerPath: 'docs/tracks/linkly/README.md',
  });
}

describe('parseTrackerStories', () => {
  it('parses contract rows and computes eligibility from configured statuses', () => {
    const stories = parseStories(trackerMarkdown);

    expect(stories.map((story) => story.id)).toEqual(['L001', 'L002', 'L003', 'L004']);
    expect(stories[1]).toMatchObject({
      id: 'L002',
      title: 'Pilot',
      owner: null,
      dependencies: ['L001'],
      eligible: true,
      blockedReason: null,
      metadata: {
        trackId: 'linkly',
        trackTitle: 'Linkly tracker',
        trackerPath: 'docs/tracks/linkly/README.md',
        wave: '2',
      },
    });
    expect(stories[2].eligible).toBe(false);
    expect(stories[2].blockedReason).toBe('owner is arye');
    expect(stories[3].eligible).toBe(false);
    expect(stories[3].blockedReason).toBe('dependencies are not complete: L999');
  });

  it('requires exact tracker contract columns', () => {
    expect(() =>
      parseTrackerStories('| ID | Name | Status |\n| --- | --- | --- |\n| L001 | Bad | specced |', {
        completeStatuses: new Set(['done']),
        eligibleStatuses: new Set(['specced']),
        idPattern: /^[A-Z]+[0-9]+$/,
        trackId: 'bad',
        trackTitle: 'Bad',
        trackerPath: 'docs/tracks/bad/README.md',
      }),
    ).toThrow('docs/tracks/bad/README.md must contain the contract status matrix columns');
  });

  it('rejects duplicate IDs', () => {
    const duplicate = trackerMarkdown.replace('| L002 | Pilot | L001 |', '| L001 | Pilot | L001 |');
    expect(() =>
      parseTrackerStories(duplicate, {
        completeStatuses: new Set(['done']),
        eligibleStatuses: new Set(['specced']),
        idPattern: /^[A-Z]+[0-9]+$/,
        trackId: 'dup',
        trackTitle: 'Dup',
        trackerPath: 'docs/tracks/dup/README.md',
      }),
    ).toThrow('duplicate story id L001 in docs/tracks/dup/README.md');
  });

  it('rejects invalid story IDs inside the contract matrix', () => {
    const invalid = trackerMarkdown.replace('| L002 | Pilot | L001 |', '| bad-id | Pilot | L001 |');
    expect(() =>
      parseTrackerStories(invalid, {
        completeStatuses: new Set(['done']),
        eligibleStatuses: new Set(['specced']),
        idPattern: /^[A-Z]+[0-9]+$/,
        trackId: 'invalid',
        trackTitle: 'Invalid',
        trackerPath: 'docs/tracks/invalid/README.md',
      }),
    ).toThrow('invalid story id bad-id in docs/tracks/invalid/README.md');
  });

  it('strips inline markdown from cells and treats dash markers as unowned', () => {
    const markdown = trackerMarkdown.replace(
      '| L002 | Pilot | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |',
      '| L002 | **Pilot** | [L001](#l001) | 2 | specced | [spec](../../specs/l002.md) | — | - | — |',
    );

    const stories = parseTrackerStories(markdown, {
      completeStatuses: new Set(['done']),
      eligibleStatuses: new Set(['specced']),
      idPattern: /^[A-Z]+[0-9]+$/,
      trackId: 'markdown',
      trackTitle: 'Markdown',
      trackerPath: 'docs/tracks/markdown/README.md',
    });

    expect(stories.find((story) => story.id === 'L002')).toMatchObject({
      title: 'Pilot',
      dependencies: ['L001'],
      owner: null,
      metadata: {
        spec: '[spec](../../specs/l002.md)',
      },
    });
  });

  it('splits dependency tokens on commas, semicolons, and slashes', () => {
    const markdown = trackerMarkdown.replace('| L004 | Waiting | L999 |', '| L004 | Waiting | L001, L002; L003/L999 |');

    const stories = parseTrackerStories(markdown, {
      completeStatuses: new Set(['done']),
      eligibleStatuses: new Set(['specced']),
      idPattern: /^[A-Z]+[0-9]+$/,
      trackId: 'deps',
      trackTitle: 'Deps',
      trackerPath: 'docs/tracks/deps/README.md',
    });

    expect(stories.find((story) => story.id === 'L004')?.dependencies).toEqual(['L001', 'L002', 'L003', 'L999']);
  });

  it('throws a file-line error for an indented tracker table', () => {
    const indented = trackerMarkdown
      .split('\n')
      .map((line) => (line.startsWith('|') ? `    ${line}` : line))
      .join('\n');

    expect(() => parseStories(indented)).toThrow(
      'Tracker table at docs/tracks/linkly/README.md:11 is indented; GFM tables must start at column 0',
    );
  });

  it('detects an indented table that uses single-dash delimiters', () => {
    const markdown = ['# Track', '', '    | ID | Status |', '    | - | - |', '    | L001 | specced |', ''].join('\n');

    expect(() => parseStories(markdown)).toThrow(/is indented; GFM tables must start at column 0/);
  });

  it('parses a normal column-0 tracker table', () => {
    expect(parseStories(trackerMarkdown).map((story) => story.id)).toEqual(['L001', 'L002', 'L003', 'L004']);
  });

  it('parses a one-space-indented tracker table', () => {
    const indented = trackerMarkdown
      .split('\n')
      .map((line) => (line.startsWith('|') ? ` ${line}` : line))
      .join('\n');

    expect(parseStories(indented).map((story) => story.id)).toEqual(['L001', 'L002', 'L003', 'L004']);
  });

  it('strips GFM inline code and strikethrough from parsed cells', () => {
    const markdown = trackerMarkdown.replace(
      '| L002 | Pilot | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |',
      '| L002 | `Pilot` | L001 | 2 | ~~specced~~ | [spec](../../specs/l002.md) | — | `arye` | — |',
    );

    expect(parseStories(markdown).find((story) => story.id === 'L002')).toMatchObject({
      title: 'Pilot',
      status: 'specced',
      owner: 'arye',
    });
  });

  it('keeps an escaped pipe inside one GFM table cell', () => {
    const markdown = trackerMarkdown.replace(
      '| L002 | Pilot | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |',
      '| L002 | Pilot \\| launch | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |',
    );

    expect(parseStories(markdown).find((story) => story.id === 'L002')?.title).toBe('Pilot | launch');
  });

  it('keeps an escaped pipe inside one raw metadata cell', () => {
    const markdown = trackerMarkdown.replace(
      '| L002 | Pilot | L001 | 2 | specced | [spec](../../specs/l002.md) | — | — | — |',
      '| L002 | Pilot | L001 | 2 | specced | [spec\\|doc](../../specs/l002.md) | — | — | — |',
    );

    expect(parseStories(markdown).find((story) => story.id === 'L002')?.metadata.spec).toBe(
      '[spec|doc](../../specs/l002.md)',
    );
  });
});

describe('validateTrackerMarkdown', () => {
  it('returns an ok report for a contract-compliant tracker', () => {
    const report = validateTrackerMarkdown(
      trackerMarkdown
        .replace('| L004 | Waiting | L999 |', '| L004 | Waiting | L001 |')
        .replace(
          '| L003 | Claimed | L001 | 2 | specced | [spec](../../specs/l003.md) | — | arye | — |',
          '| L003 | Claimed | L001 | 2 | specced | [spec](../../specs/l003.md) | — | — | — |',
        ),
      {
        ...validationContext(),
      },
    );

    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({ storyCount: 4, errorCount: 0 });
    expect(report.diagnostics).toEqual([]);
  });

  it('reports actionable tracker contract diagnostics without throwing', () => {
    const invalid = trackerMarkdown
      .replace('| L002 | Pilot | L001 |', '| BAD-2 | Pilot | nope |')
      .replace('| L003 | Claimed | L001 | 2 | specced |', '| L001 | Claimed | L001 | 2 | mystery |')
      .replace('| L004 | Waiting | L999 |', '| ZZ04 | Waiting | L999 |')
      .replace('[spec](../../specs/l001.md)', '—');

    const report = validateTrackerMarkdown(invalid, {
      ...validationContext(),
      expectedIdPrefix: 'L',
      storyBriefBaseDir: 'docs/tracks/linkly/stories',
      existingStoryBriefs: new Set(['docs/tracks/linkly/stories/L002.md']),
    });

    expect(report.ok).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STORY_ID_INVALID', line: 14, severity: 'error' }),
        expect.objectContaining({ code: 'DEPENDENCY_TOKEN_INVALID', line: 14, severity: 'error' }),
        expect.objectContaining({ code: 'STORY_ID_DUPLICATE', line: 15, severity: 'error' }),
        expect.objectContaining({ code: 'STATUS_INVALID', line: 15, severity: 'error' }),
        expect.objectContaining({ code: 'DEPENDENCY_UNKNOWN', line: 16, severity: 'error' }),
        expect.objectContaining({ code: 'ID_PREFIX_MISMATCH', line: 16, severity: 'error' }),
        expect.objectContaining({ code: 'STORY_BRIEF_MISSING', line: 13, severity: 'warning' }),
        expect.objectContaining({ code: 'OWNER_CONFLICT', line: 15, severity: 'warning' }),
      ]),
    );
  });

  it('reports missing contract columns', () => {
    const report = validateTrackerMarkdown('| ID | Name | Status |\n| --- | --- | --- |\n| L001 | Bad | specced |', {
      ...validationContext(),
    });

    expect(report.ok).toBe(false);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MISSING_CONTRACT_COLUMNS', severity: 'error' }),
    );
  });
});

describe('migrateMarkdownTracker', () => {
  it('converts a custom markdown backlog table into a draft kit tracker and migration report', () => {
    const source = `# Imported backlog

| Key | Summary | Blocked By | Phase | State | Assignee |
| --- | --- | --- | --- | --- | --- |
| APP-1 | Build shell | — | W1 | complete | — |
| APP-2 | Add sync | APP-1 | W2 | todo | nina |
`;

    const result = migrateMarkdownTracker(source, {
      trackId: 'imported-app',
      trackTitle: 'Imported App tracker',
      idPrefix: 'APP',
      idPattern: /^[A-Z]{2,}[0-9]+$/,
      statusVocabulary: validationContext().statusVocabulary,
    });

    expect(result.report.ok).toBe(true);
    expect(result.report.summary).toMatchObject({ importedRows: 2, generatedStoryBriefCount: 2 });
    expect(result.draftMarkdown).toContain(
      '| APP1 | Build shell | — | W1 | done | [brief](./stories/APP1.md) | — | — | — |',
    );
    expect(result.draftMarkdown).toContain(
      '| APP2 | Add sync | APP1 | W2 | specced | [brief](./stories/APP2.md) | — | nina | — |',
    );
    expect(result.report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STATUS_MAPPED', severity: 'warning', sourceValue: 'complete' }),
        expect.objectContaining({ code: 'ID_NORMALIZED', severity: 'warning', sourceValue: 'APP-1' }),
      ]),
    );
  });

  it('does not treat a Blocks column as Depends on during migration', () => {
    const source = `# Imported backlog

| Key | Summary | Blocks | State |
| --- | --- | --- | --- |
| APP-1 | Build shell | APP-2 | todo |
`;

    const result = migrateMarkdownTracker(source, {
      trackId: 'imported-app',
      trackTitle: 'Imported App tracker',
      idPrefix: 'APP',
      idPattern: /^[A-Z]{2,}[0-9]+$/,
      statusVocabulary: validationContext().statusVocabulary,
    });

    expect(result.draftMarkdown).toContain('| APP1 | Build shell | — | W1 | specced |');
  });

  it('uses configured status vocabulary when migrating custom backlog states', () => {
    const source = `# Imported backlog

| Key | Summary | State |
| --- | --- | --- |
| APP-1 | Build shell | todo |
| APP-2 | Ship shell | complete |
`;

    const result = migrateMarkdownTracker(source, {
      trackId: 'imported-app',
      trackTitle: 'Imported App tracker',
      idPrefix: 'APP',
      idPattern: /^[A-Z]{2,}[0-9]+$/,
      statusVocabulary: ['ready', 'finished'],
      defaultEligibleStatus: 'ready',
      defaultCompleteStatus: 'finished',
    });

    expect(result.draftMarkdown).toContain('| APP1 | Build shell | — | W1 | ready |');
    expect(result.draftMarkdown).toContain('| APP2 | Ship shell | — | W1 | finished |');
  });
});

describe('discoverMarkdownTracks', () => {
  it('discovers active trackers and skips archived paths/frontmatter', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-tracks-'));
    await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
    await mkdir(path.join(root, 'docs/tracks/archive/old'), { recursive: true });
    await mkdir(path.join(root, 'docs/tracks/archived-frontmatter'), { recursive: true });
    await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown);
    await writeFile(path.join(root, 'docs/tracks/archive/old/README.md'), trackerMarkdown);
    await writeFile(
      path.join(root, 'docs/tracks/archived-frontmatter/README.md'),
      trackerMarkdown.replace('status: approved', 'status: archived'),
    );

    const tracks = await discoverMarkdownTracks({
      workspaceRoot: root,
      tracksDir: 'docs/tracks',
      archiveDir: 'docs/tracks/archive',
      completeStatuses: ['done', 'verified'],
      eligibleStatuses: ['specced', 'plan-approved'],
      idPattern: '^[A-Z]{1,}[0-9]+$',
    });

    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('linkly');
    expect(tracks[0].stories.some((story) => story.id === 'L002' && story.eligible)).toBe(true);
  });
});

function validationContext() {
  return {
    completeStatuses: new Set(['done', 'verified']),
    eligibleStatuses: new Set(['specced', 'plan-approved']),
    statusVocabulary: [
      'specced',
      'plan-approved',
      'implementing',
      'done',
      'verified',
      'blocked',
      'canceled',
      'deferred',
      'superseded',
    ],
    idPattern: /^[A-Z]{1,}[0-9]+$/,
    trackId: 'linkly',
    trackTitle: 'Linkly tracker',
    trackerPath: 'docs/tracks/linkly/README.md',
  };
}
