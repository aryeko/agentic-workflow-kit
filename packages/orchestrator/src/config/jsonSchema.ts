import { z } from 'zod';
import { isRecord } from '../internal/guards.js';
import { ConfigSchema } from './schema.js';

const ID = 'https://github.com/aryeko/agentic-workflow-kit/config.schema.json';

export function buildConfigJsonSchema(): Record<string, unknown> {
  const generated = z.toJSONSchema(ConfigSchema) as Record<string, unknown>;
  const schema = addChildSessionSpeedConflictRules(
    relaxObjectRequired({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: ID,
      title: 'agentic-workflow-kit config',
      ...generated,
    }),
  );
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

function addChildSessionSpeedConflictRules(schema: Record<string, unknown>): Record<string, unknown> {
  const existingAllOf = Array.isArray(schema.allOf) ? schema.allOf : [];
  return {
    ...schema,
    allOf: [
      ...existingAllOf,
      rejectWhen(explicitNeutralSpeed(), neutralRawServiceTier()),
      rejectWhen(explicitNeutralSpeed(), codexRawServiceTier()),
      rejectWhen(noNeutralSpeed(), explicitCodexSpeed(), neutralRawServiceTier()),
      rejectWhen(noNeutralSpeed(), explicitCodexSpeed(), codexRawServiceTier()),
    ],
  };
}

function rejectWhen(...allOf: Record<string, unknown>[]): Record<string, unknown> {
  return { not: { allOf } };
}

function explicitNeutralSpeed(): Record<string, unknown> {
  return {
    required: ['childSession'],
    properties: {
      childSession: {
        required: ['speed'],
        properties: {
          speed: fastOrStandardSpeed(),
        },
      },
    },
  };
}

function explicitCodexSpeed(): Record<string, unknown> {
  return {
    required: ['codex'],
    properties: {
      codex: {
        required: ['childSession'],
        properties: {
          childSession: {
            required: ['speed'],
            properties: {
              speed: fastOrStandardSpeed(),
            },
          },
        },
      },
    },
  };
}

function noNeutralSpeed(): Record<string, unknown> {
  return {
    not: {
      required: ['childSession'],
      properties: {
        childSession: {
          required: ['speed'],
        },
      },
    },
  };
}

function neutralRawServiceTier(): Record<string, unknown> {
  return {
    required: ['childSession'],
    properties: {
      childSession: {
        required: ['config'],
        properties: {
          config: {
            required: ['service_tier'],
          },
        },
      },
    },
  };
}

function codexRawServiceTier(): Record<string, unknown> {
  return {
    required: ['codex'],
    properties: {
      codex: {
        required: ['childSession'],
        properties: {
          childSession: {
            required: ['config'],
            properties: {
              config: {
                required: ['service_tier'],
              },
            },
          },
        },
      },
    },
  };
}

function fastOrStandardSpeed(): Record<string, unknown> {
  return { enum: ['fast', 'standard'] };
}
