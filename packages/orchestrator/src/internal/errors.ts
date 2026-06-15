export type WorkflowApiErrorCode =
  | 'CONFIG_INVALID'
  | 'TRACKER_INVALID'
  | 'STORY_NOT_ELIGIBLE'
  | 'RUN_NOT_FOUND'
  | 'INTERNAL_ERROR';

interface WorkflowKitErrorOptions {
  retryable?: boolean;
  cause?: unknown;
}

export class WorkflowKitError extends Error {
  readonly code: WorkflowApiErrorCode;
  readonly retryable: boolean;

  constructor(message: string, code: WorkflowApiErrorCode, options: WorkflowKitErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export class WorkflowConfigError extends WorkflowKitError {
  constructor(message: string, options: WorkflowKitErrorOptions = {}) {
    super(message, 'CONFIG_INVALID', options);
  }
}

export class WorkflowTrackerError extends WorkflowKitError {
  constructor(message: string, options: WorkflowKitErrorOptions = {}) {
    super(message, 'TRACKER_INVALID', options);
  }
}

export class WorkflowStoryNotEligibleError extends WorkflowKitError {
  constructor(message: string, options: WorkflowKitErrorOptions = {}) {
    super(message, 'STORY_NOT_ELIGIBLE', options);
  }
}

export class WorkflowRunNotFoundError extends WorkflowKitError {
  constructor(message: string, options: WorkflowKitErrorOptions = {}) {
    super(message, 'RUN_NOT_FOUND', options);
  }
}

export class WorkflowInternalError extends WorkflowKitError {
  constructor(message: string, options: WorkflowKitErrorOptions = {}) {
    super(message, 'INTERNAL_ERROR', options);
  }
}

export function isWorkflowKitError(error: unknown): error is WorkflowKitError {
  return error instanceof WorkflowKitError;
}

export function workflowKitErrorFromUnknown(
  error: unknown,
  fallbackCode: WorkflowApiErrorCode = 'INTERNAL_ERROR',
): WorkflowKitError {
  if (isWorkflowKitError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  const options = { cause: error };
  switch (fallbackCode) {
    case 'CONFIG_INVALID':
      return new WorkflowConfigError(message, options);
    case 'TRACKER_INVALID':
      return new WorkflowTrackerError(message, options);
    case 'STORY_NOT_ELIGIBLE':
      return new WorkflowStoryNotEligibleError(message, options);
    case 'RUN_NOT_FOUND':
      return new WorkflowRunNotFoundError(message, options);
    case 'INTERNAL_ERROR':
      return new WorkflowInternalError(message, options);
  }
}
