import { createCredentialUseDenied, createRedactionApplied } from '../audit/index.js';
import { createCredentialDenied } from '../failures/index.js';

import { createRedactionSet, getCompiledRedactionSet } from './create-redaction-set.js';
import type {
  ArtifactRedactionFailure,
  ArtifactRedactionResult,
  RedactArtifactInput,
  RedactedInput,
  RedactInput,
  RedactResult,
  RedactionDependencies,
  RedactionSet,
  TextArtifact,
} from './redaction-types.js';

type RedactionState = {
  readonly replacementCount: number;
  readonly fingerprintIds: ReadonlySet<string>;
};

type RedactionTraversalSuccess = {
  readonly ok: true;
  readonly value: RedactedInput | Error;
  readonly state: RedactionState;
};

type RedactionTraversalFailure = {
  readonly ok: false;
};

type RedactionTraversalContext = {
  readonly depth: number;
  readonly visited: WeakSet<object>;
};

const SUPPORTED_TEXT_ARTIFACT_MEDIA_TYPES = ['text/plain', 'application/json'] as const;
const MAX_REDACTION_DEPTH = 64;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createEmptyState = (): RedactionState => ({
  replacementCount: 0,
  fingerprintIds: new Set<string>(),
});

const isUsableRedactionSet = (redactionSet: RedactionSet | undefined): redactionSet is RedactionSet => {
  if (redactionSet === undefined) {
    return false;
  }

  const compiled = getCompiledRedactionSet(redactionSet);
  return compiled !== undefined && compiled.patterns.length > 0;
};

const denyRedactionUnavailable = <T extends RedactedInput>(
  input: RedactInput<T>,
  dependencies: RedactionDependencies,
): RedactResult<T> =>
  createCredentialDenied(
    'redaction-unavailable',
    createCredentialUseDenied(
      {
        audit: input.audit,
        reason: 'redaction-unavailable',
      },
      dependencies,
    ),
  );

const createArtifactRedactionFailure = (
  artifactId: string,
  mediaType: string,
  reason: ArtifactRedactionFailure['reason'],
): ArtifactRedactionFailure => ({
  ok: false,
  token: 'artifact-redaction-failed',
  artifactId,
  mediaType,
  reason,
});

const mergeFingerprintIds = (left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> => {
  if (right.size === 0) {
    return left;
  }

  if (left.size === 0) {
    return right;
  }

  return new Set<string>([...left, ...right]);
};

const redactString = (
  value: string,
  redactionSet: RedactionSet,
): {
  readonly value: string;
  readonly state: RedactionState;
} => {
  const compiled = getCompiledRedactionSet(redactionSet);
  if (compiled === undefined) {
    return {
      value,
      state: createEmptyState(),
    };
  }

  let nextValue = value;
  let replacementCount = 0;
  const fingerprintIds = new Set<string>();

  for (const pattern of compiled.patterns) {
    const matches = nextValue.match(new RegExp(escapeRegExp(pattern.value), 'g'));
    if (matches === null || matches.length === 0) {
      continue;
    }

    nextValue = nextValue.replace(new RegExp(escapeRegExp(pattern.value), 'g'), pattern.replacement);
    replacementCount += matches.length;
    fingerprintIds.add(pattern.fingerprintId);
  }

  return {
    value: nextValue,
    state: {
      replacementCount,
      fingerprintIds,
    },
  };
};

const redactError = (
  value: Error,
  redactionSet: RedactionSet,
): {
  readonly value: Error;
  readonly state: RedactionState;
} => {
  const redactedName = redactString(value.name, redactionSet);
  const redactedMessage = redactString(value.message, redactionSet);
  const redactedStack =
    value.stack === undefined
      ? {
          value: undefined,
          state: createEmptyState(),
        }
      : redactString(value.stack, redactionSet);

  const nextError = new Error(redactedMessage.value);
  nextError.name = redactedName.value;
  if (redactedStack.value !== undefined) {
    nextError.stack = redactedStack.value;
  } else {
    nextError.stack = undefined;
  }

  return {
    value: nextError,
    state: {
      replacementCount:
        redactedName.state.replacementCount +
        redactedMessage.state.replacementCount +
        redactedStack.state.replacementCount,
      fingerprintIds: mergeFingerprintIds(
        mergeFingerprintIds(redactedName.state.fingerprintIds, redactedMessage.state.fingerprintIds),
        redactedStack.state.fingerprintIds,
      ),
    },
  };
};

const redactUnknown = (
  value: RedactedInput | Error,
  redactionSet: RedactionSet,
  context: RedactionTraversalContext,
): RedactionTraversalSuccess | RedactionTraversalFailure => {
  if (typeof value === 'string') {
    const redacted = redactString(value, redactionSet);
    return {
      ok: true,
      ...redacted,
    };
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return {
      ok: true,
      value,
      state: createEmptyState(),
    };
  }

  if (value instanceof Error) {
    const redacted = redactError(value, redactionSet);
    return {
      ok: true,
      ...redacted,
    };
  }

  if (typeof value !== 'object' || context.depth >= MAX_REDACTION_DEPTH) {
    return {
      ok: false,
    };
  }

  if (Array.isArray(value)) {
    if (context.visited.has(value)) {
      return {
        ok: false,
      };
    }

    context.visited.add(value);
    let replacementCount = 0;
    let fingerprintIds = new Set<string>();
    const arrayValue: RedactedInput[] = [];

    try {
      for (const item of value) {
        const redacted = redactUnknown(item, redactionSet, {
          ...context,
          depth: context.depth + 1,
        });
        if (!redacted.ok) {
          return redacted;
        }

        replacementCount += redacted.state.replacementCount;
        fingerprintIds = new Set<string>([...fingerprintIds, ...redacted.state.fingerprintIds]);
        arrayValue.push(redacted.value as RedactedInput);
      }

      return {
        ok: true,
        value: arrayValue,
        state: {
          replacementCount,
          fingerprintIds,
        },
      };
    } finally {
      context.visited.delete(value);
    }
  }

  if (context.visited.has(value)) {
    return {
      ok: false,
    };
  }

  context.visited.add(value);
  let replacementCount = 0;
  let fingerprintIds = new Set<string>();
  const nextEntries: [string, RedactedInput][] = [];

  try {
    for (const [key, nestedValue] of Object.entries(value)) {
      const redactedKey = redactString(key, redactionSet);
      const redactedValue = redactUnknown(nestedValue as RedactedInput, redactionSet, {
        ...context,
        depth: context.depth + 1,
      });
      if (!redactedValue.ok) {
        return redactedValue;
      }

      replacementCount += redactedKey.state.replacementCount + redactedValue.state.replacementCount;
      fingerprintIds = new Set<string>([
        ...fingerprintIds,
        ...redactedKey.state.fingerprintIds,
        ...redactedValue.state.fingerprintIds,
      ]);
      nextEntries.push([redactedKey.value, redactedValue.value as RedactedInput]);
    }

    return {
      ok: true,
      value: Object.fromEntries(nextEntries),
      state: {
        replacementCount,
        fingerprintIds,
      },
    };
  } finally {
    context.visited.delete(value);
  }
};

export const redact = <T extends RedactedInput>(
  input: RedactInput<T>,
  dependencies: RedactionDependencies,
): RedactResult<T> => {
  if (!isUsableRedactionSet(input.redactionSet)) {
    return denyRedactionUnavailable(input, dependencies);
  }

  const redacted = redactUnknown(input.value, input.redactionSet, {
    depth: 0,
    visited: new WeakSet<object>(),
  });
  if (!redacted.ok) {
    return denyRedactionUnavailable(input, dependencies);
  }

  const redactionFingerprintIds = input.redactionSet.fingerprintIds.filter((fingerprintId) =>
    redacted.state.fingerprintIds.has(fingerprintId),
  );

  return {
    ok: true,
    value: redacted.value as T,
    replacementCount: redacted.state.replacementCount,
    redactionFingerprintIds,
    auditEvent: createRedactionApplied(
      {
        audit: input.audit,
        sink: input.sink,
        replacementCount: redacted.state.replacementCount,
        redactionFingerprintIds,
      },
      dependencies,
    ),
  };
};

export const redactArtifact = (
  input: RedactArtifactInput,
  dependencies: RedactionDependencies,
): ArtifactRedactionResult => {
  if (!SUPPORTED_TEXT_ARTIFACT_MEDIA_TYPES.includes(input.artifact.mediaType as TextArtifact['mediaType'])) {
    return createArtifactRedactionFailure(input.artifact.artifactId, input.artifact.mediaType, 'binary-media-type');
  }

  if (typeof input.artifact.text !== 'string') {
    return createArtifactRedactionFailure(input.artifact.artifactId, input.artifact.mediaType, 'text-unavailable');
  }

  return redact(
    {
      value: {
        artifactId: input.artifact.artifactId,
        mediaType: input.artifact.mediaType as TextArtifact['mediaType'],
        text: input.artifact.text,
      },
      redactionSet: input.redactionSet,
      audit: input.audit,
      sink: input.sink ?? `artifact:${input.artifact.artifactId}`,
    },
    dependencies,
  );
};

export { createRedactionSet };
