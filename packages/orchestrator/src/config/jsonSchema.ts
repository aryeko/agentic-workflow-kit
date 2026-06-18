import { z } from 'zod';
import { isRecord } from '../internal/guards.js';
import { CURRENT_CONFIG_SCHEMA_VERSION, MIN_SUPPORTED_CONFIG_SCHEMA_VERSION } from '../runtime/version.js';
import { ConfigSchema } from './schema.js';

const ID = 'https://github.com/aryeko/agentic-workflow-kit/config.schema.json';

export function buildConfigJsonSchema(): Record<string, unknown> {
  const generated = z.toJSONSchema(ConfigSchema) as Record<string, unknown>;
  const schema = addChildSessionSpeedConflictRules(
    addVersionCompatibilityRule(
      relaxObjectRequired({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: ID,
        title: 'agentic-workflow-kit config',
        ...generated,
      }),
    ),
  );
  schema.$comment = 'Runtime validation: every agents.bindings value must reference a key in agents.profiles.';
  return schema;
}

/**
 * Build the set of semver version strings accepted by the JSON schema.
 *
 * The runtime accepts any semver in [MIN_SUPPORTED_CONFIG_SCHEMA_VERSION,
 * CURRENT_CONFIG_SCHEMA_VERSION].  The JSON schema mirrors that contract by
 * enumerating the minor-version series between the two endpoints (patch 0
 * only, matching the release cadence) so a still-supported config such as
 * `version: "0.6.0"` validates successfully without schema changes.
 *
 * When a new minor series is released (e.g. 0.8.0) updating the two version
 * constants in version.ts is the only change needed — this function will
 * automatically include every minor series in the new range.
 */
function supportedSemverStrings(): string[] {
  const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
  function parse(v: string): [number, number, number] {
    const m = v.match(SEMVER);
    if (!m) throw new Error(`Invalid semver constant: ${v}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  const [minMaj, minMin] = parse(MIN_SUPPORTED_CONFIG_SCHEMA_VERSION);
  const [maxMaj, maxMin] = parse(CURRENT_CONFIG_SCHEMA_VERSION);
  const result: string[] = [];

  // Only enumerate minor series at patch .0 — intermediate patches are
  // accepted at runtime but have never been released as distinct schema
  // versions.  The envelope is kept tight to avoid false acceptances.
  for (let major = minMaj; major <= maxMaj; major++) {
    const minorStart = major === minMaj ? minMin : 0;
    const minorEnd = major === maxMaj ? maxMin : 99;
    for (let minor = minorStart; minor <= minorEnd; minor++) {
      result.push(`${major}.${minor}.0`);
    }
  }

  return result;
}

function addVersionCompatibilityRule(schema: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(schema.properties)) return schema;
  const supportedVersions = supportedSemverStrings();
  schema.properties.version = {
    anyOf: [...supportedVersions.map((v) => ({ type: 'string', const: v })), { type: 'number', const: 1 }],
    default: CURRENT_CONFIG_SCHEMA_VERSION,
  };
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
