import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('core-01-s5 projection purity', () => {
  it('does not reference append or writer surfaces', () => {
    const projectionFiles = [
      'index.ts',
      'project.ts',
      'state-projection.ts',
      'summary-projection.ts',
      'metrics-projection.ts',
      'launch-projection.ts',
    ];
    const forbidden = /openForAppend|append|createRun|openWriter|LeaseCapability|RunWriter/;

    for (const file of projectionFiles) {
      const source = readFileSync(join(process.cwd(), 'packages/sdk/src/core/run-lifecycle/projections', file), 'utf8');

      expect(source).not.toMatch(forbidden);
    }
  });
});
