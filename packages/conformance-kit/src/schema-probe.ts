import type { ArtifactRef } from '@kit-vnext/foundation-fnd-02';
import { z } from 'zod';

export type JsonSchemaObject = {
  readonly [key: string]: unknown;
  readonly type?: string;
  readonly properties?: Record<string, unknown>;
  readonly required?: readonly string[];
};

export type SchemaProbeFailure =
  | {
      readonly token: 'schema-invalid';
      readonly field: string;
      readonly message: string;
    }
  | {
      readonly token: 'evidence-missing';
      readonly field: 'evidenceRef';
      readonly message: string;
    };

export type SchemaProbeResult<T> =
  | {
      readonly status: 'pass';
      readonly value: T;
      readonly jsonSchema: JsonSchemaObject;
    }
  | {
      readonly status: 'fail';
      readonly failure: SchemaProbeFailure;
      readonly jsonSchema: JsonSchemaObject;
    };

export interface SchemaProbeOptions {
  readonly schemaName?: string;
  readonly resolveEvidence?: (ref: ArtifactRef) => boolean | Promise<boolean>;
}

export const toJsonSchema = <T>(schema: z.ZodType<T>, name = 'SchemaProbe'): JsonSchemaObject => {
  const jsonSchema = z.toJSONSchema(schema);

  return {
    title: name,
    ...jsonSchema,
  };
};

export const runSchemaProbe = async <T>(
  schema: z.ZodType<T>,
  payload: unknown,
  options: SchemaProbeOptions = {},
): Promise<SchemaProbeResult<T>> => {
  const jsonSchema = safeJsonSchema(schema, options.schemaName);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return {
      status: 'fail',
      failure: classifySchemaIssue(parsed.error.issues),
      jsonSchema,
    };
  }

  const evidence = evidenceRefFrom(parsed.data);
  if (options.resolveEvidence && evidence) {
    try {
      const resolved = await options.resolveEvidence(evidence);
      if (!resolved) {
        return {
          status: 'fail',
          failure: {
            token: 'evidence-missing',
            field: 'evidenceRef',
            message: 'evidenceRef could not be resolved',
          },
          jsonSchema,
        };
      }
    } catch {
      return {
        status: 'fail',
        failure: {
          token: 'evidence-missing',
          field: 'evidenceRef',
          message: 'evidenceRef resolver failed',
        },
        jsonSchema,
      };
    }
  }

  return {
    status: 'pass',
    value: parsed.data,
    jsonSchema,
  };
};

const safeJsonSchema = <T>(schema: z.ZodType<T>, name?: string): JsonSchemaObject => {
  try {
    return toJsonSchema(schema, name);
  } catch {
    return { type: 'object' };
  }
};

const classifySchemaIssue = (issues: readonly z.core.$ZodIssue[]): SchemaProbeFailure => {
  const firstIssue = issues[0];
  const field = typeof firstIssue?.path[0] === 'string' ? firstIssue.path[0] : '<root>';

  if (field === 'evidenceRef') {
    return {
      token: 'evidence-missing',
      field: 'evidenceRef',
      message: firstIssue?.message ?? 'evidenceRef is missing or invalid',
    };
  }

  return {
    token: 'schema-invalid',
    field,
    message: firstIssue?.message ?? 'payload failed schema validation',
  };
};

const evidenceRefFrom = (value: unknown): ArtifactRef | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const evidenceRef = value.evidenceRef;
  return isRecord(evidenceRef) ? (evidenceRef as unknown as ArtifactRef) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
