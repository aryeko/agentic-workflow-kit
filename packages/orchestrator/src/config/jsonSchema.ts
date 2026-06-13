import { z } from 'zod';
import { isRecord } from '../internal/guards.js';
import { ConfigSchema } from './schema.js';

const ID = 'https://github.com/aryeko/agentic-workflow-kit/config.schema.json';

export function buildConfigJsonSchema(): Record<string, unknown> {
  const generated = z.toJSONSchema(ConfigSchema) as Record<string, unknown>;
  const schema = relaxObjectRequired({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: ID,
    title: 'agentic-workflow-kit config',
    ...generated,
  });
  schema.$comment = 'Runtime validation: every agents.bindings value must reference a key in agents.profiles.';
  return schema;
}

export function serializeConfigJsonSchema(): string {
  return `${JSON.stringify(buildConfigJsonSchema(), null, 2)}\n`;
}

function relaxObjectRequired(value: unknown): Record<string, unknown> {
  const relaxed = relaxObjectRequiredInner(value, true);
  if (!isRecord(relaxed)) {
    throw new Error('Expected generated config JSON Schema to be an object');
  }
  return relaxed;
}

function relaxObjectRequiredInner(value: unknown, isRoot: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => relaxObjectRequiredInner(entry, false));
  }
  if (!isRecord(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = relaxObjectRequiredInner(child, false);
  }

  if (next.type === 'object') {
    if (isRoot) {
      next.required = ['version'];
    } else {
      delete next.required;
    }
  }

  return next;
}
