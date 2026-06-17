import { readdirSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const schema = JSON.parse(readFileSync('references/config.schema.json', 'utf8'));
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

function loadPreset(name: string) {
  return parseYaml(readFileSync(`presets/${name}.yaml`, 'utf8'));
}

describe('presets', () => {
  it('ships exactly the three expected presets', () => {
    const files = readdirSync('presets')
      .filter((f) => f.endsWith('.yaml'))
      .sort();
    expect(files).toEqual(['gated-automerge.yaml', 'push-and-merge.yaml', 'push-only.yaml']);
  });

  for (const name of ['push-and-merge', 'gated-automerge', 'push-only']) {
    it(`${name} declares the current semver config schema version`, () => {
      expect(loadPreset(name).version).toBe('0.7.0');
    });

    it(`${name} validates against the schema`, () => {
      expect(validate(loadPreset(name))).toBe(true);
    });

    it(`${name} ships default agent profiles and task bindings`, () => {
      const preset = loadPreset(name);

      expect(preset.agents.bindings.implementStory).toBe('storyImplementer');
      expect(preset.agents.bindings.prePrReview).toBe('prePrReviewer');
      expect(Object.keys(preset.agents.profiles).sort()).toEqual([
        'analyzer',
        'planner',
        'prePrReviewer',
        'recovery',
        'storyImplementer',
      ]);
      expect(preset.agents.profiles.storyImplementer.budget.wallMs).toEqual({
        limit: 7_200_000,
        warnAtPercent: 80,
        action: 'checkpoint-stop',
      });
    });
  }

  it('push-and-merge does not wait and auto-merges (ship-fast repo)', () => {
    const p = loadPreset('push-and-merge');
    expect(p.implement.review.prePr.enabled).toBe(true);
    expect(p.implement.review.prePr.mode).toBe('auto');
    expect(p.implement.review.prePr.maxLoops).toBe(2);
    expect(p.implement.review.prePr.loopMode).toBe('incremental');
    expect(p.implement.subagents.allowWorkers).toBe(false);
    expect(p.pr.ci.wait).toBe(false);
    expect(p.pr.review.wait).toBe('none');
    expect(p.pr.review.maxFixBatches).toBe(1);
    expect(p.pr.review.rerequestAfterFix).toBe(false);
    expect(p.pr.merge.auto).toBe(true);
    expect(p.pr.merge.method).toBe('squash');
  });

  it('gated-automerge waits on CI + codex review then auto-merges (CI + bot-review repo)', () => {
    const p = loadPreset('gated-automerge');
    expect(p.verify.changed).toBeNull();
    expect(p.verify.full).toBeNull();
    expect(p.pr.ci.wait).toBe(true);
    expect(p.pr.review.wait).toBe('bot');
    expect(p.pr.review.bot).toBe('codex');
    expect(p.pr.review.triageComments).toBe(true);
    expect(p.pr.review.waitTimeoutMinutes).toBe(30);
    expect(p.pr.merge.auto).toBe(true);
  });

  it('push-only opens a PR but never auto-merges', () => {
    const p = loadPreset('push-only');
    expect(p.pr.create).toBe(true);
    expect(p.pr.merge.auto).toBe(false);
  });
});
