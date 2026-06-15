import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { selectPreset } from '../src/config/preset';

type PresetName = 'push-and-merge' | 'gated-automerge' | 'push-only';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function loadPreset(name: PresetName): { pr: unknown } {
  return parseYaml(readFileSync(path.join(repoRoot, `presets/${name}.yaml`), 'utf8')) as { pr: unknown };
}

function readPresetTable(): Map<PresetName, string[]> {
  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const rows = new Map<PresetName, string[]>();

  for (const line of readme.split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const preset = cells[0]?.match(/^`([^`]+)`$/)?.[1] as PresetName | undefined;
    if (preset) rows.set(preset, cells);
  }

  return rows;
}

describe('selectPreset', () => {
  it('chooses push-only when reviews are required', () => {
    expect(selectPreset({ requiresReview: true, hasCI: true })).toBe('push-only');
    expect(selectPreset({ requiresReview: true, hasCI: false })).toBe('push-only');
  });
  it('chooses push-only when CI exists and no required reviews', () => {
    expect(selectPreset({ requiresReview: false, hasCI: true })).toBe('push-only');
  });
  it('chooses push-only when neither CI nor required reviews', () => {
    expect(selectPreset({ requiresReview: false, hasCI: false })).toBe('push-only');
  });

  it.each([
    {
      signals: { requiresReview: false, hasCI: false },
      name: 'push-and-merge',
      table: ['no', 'no', 'yes (squash)'],
      pr: { ci: { wait: false }, review: { wait: 'none' }, merge: { auto: true, method: 'squash' } },
    },
    {
      signals: { requiresReview: false, hasCI: true },
      name: 'gated-automerge',
      table: ['yes', 'bot (e.g. codex)', 'yes (squash)'],
      pr: { ci: { wait: true }, review: { wait: 'bot', bot: 'codex' }, merge: { auto: true, method: 'squash' } },
    },
    {
      signals: { requiresReview: true, hasCI: true },
      name: 'push-only',
      table: ['no', 'no', 'no (open PR, stop)'],
      pr: { ci: { wait: false }, review: { wait: 'none' }, merge: { auto: false, method: 'squash' } },
    },
  ] as const)('keeps explicit $name preset semantics and README table in sync', ({ name, table, pr }) => {
    expect(loadPreset(name).pr).toMatchObject(pr);
    expect(readPresetTable().get(name)?.slice(1, 4)).toEqual(table);
  });
});
