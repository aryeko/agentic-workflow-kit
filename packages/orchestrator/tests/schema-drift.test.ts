import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { serializeConfigJsonSchema } from '../src/config/jsonSchema';

describe('config.schema.json is generated from the Zod schema', () => {
  it('matches the committed file (run pnpm generate-schema to update)', () => {
    const committed = readFileSync(path.resolve(__dirname, '../../../references/config.schema.json'), 'utf8');
    expect(serializeConfigJsonSchema()).toBe(committed);
  });
});
