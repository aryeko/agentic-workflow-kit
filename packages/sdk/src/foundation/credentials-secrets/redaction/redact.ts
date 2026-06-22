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

const SUPPORTED_TEXT_ARTIFACT_MEDIA_TYPES = ['text/plain', 'application/json'] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
      state: {
        replacementCount: 0,
        fingerprintIds: new Set<string>(),
      },
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
          state: {
            replacementCount: 0,
            fingerprintIds: new Set<string>(),
          },
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
): {
  readonly value: RedactedInput | Error;
  readonly state: RedactionState;
} => {
  if (typeof value === 'string') {
    return redactString(value, redactionSet);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return {
      value,
      state: {
        replacementCount: 0,
        fingerprintIds: new Set<string>(),
      },
    };
  }

  if (value instanceof Error) {
    return redactError(value, redactionSet);
  }

  if (Array.isArray(value)) {
    let replacementCount = 0;
    let fingerprintIds = new Set<string>();
    const arrayValue = value.map((item) => {
      const redacted = redactUnknown(item, redactionSet);
      replacementCount += redacted.state.replacementCount;
      fingerprintIds = new Set<string>([...fingerprintIds, ...redacted.state.fingerprintIds]);
      return redacted.value as RedactedInput;
    });

    return {
      value: arrayValue,
      state: {
        replacementCount,
        fingerprintIds,
      },
    };
  }

  let replacementCount = 0;
  let fingerprintIds = new Set<string>();
  const nextEntries: [string, RedactedInput][] = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const redactedKey = redactString(key, redactionSet);
    const redactedValue = redactUnknown(nestedValue, redactionSet);
    replacementCount += redactedKey.state.replacementCount + redactedValue.state.replacementCount;
    fingerprintIds = new Set<string>([
      ...fingerprintIds,
      ...redactedKey.state.fingerprintIds,
      ...redactedValue.state.fingerprintIds,
    ]);
    nextEntries.push([redactedKey.value, redactedValue.value as RedactedInput]);
  }

  return {
    value: Object.fromEntries(nextEntries),
    state: {
      replacementCount,
      fingerprintIds,
    },
  };
};

export const redact = <T extends RedactedInput>(
  input: RedactInput<T>,
  dependencies: RedactionDependencies,
): RedactResult<T> => {
  if (input.redactionSet === undefined || getCompiledRedactionSet(input.redactionSet) === undefined) {
    return denyRedactionUnavailable(input, dependencies);
  }

  const redacted = redactUnknown(input.value, input.redactionSet);
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
