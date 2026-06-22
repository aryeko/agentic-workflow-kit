import type { StorageError } from '../errors/storage-error.js';
import type { Result } from './result.js';
import { STORAGE_HEALTH_STATES, type StorageHealth } from './storage-health-types.js';

export { STORAGE_HEALTH_STATES, type StorageHealth };

export const AUTHORITATIVE_STORAGE_OPERATIONS = Object.freeze(['append', 'lease', 'evidence-ref', 'export'] as const);

export type AuthoritativeStorageOperation = (typeof AUTHORITATIVE_STORAGE_OPERATIONS)[number];

export type StorageHealthSemantics = {
  readonly health: StorageHealth;
  readonly readable: boolean;
  readonly authoritativeAppend: boolean;
  readonly authoritativeLease: boolean;
  readonly authoritativeEvidenceRef: boolean;
  readonly authoritativeExport: boolean;
  readonly historyCoherent: boolean;
  readonly requiresHealthAnnotation: boolean;
};

export type StorageCapabilityMatrix = {
  readonly durableLogging: boolean;
  readonly coordination: boolean;
  readonly unattendedRun: boolean;
  readonly autoRecover: boolean;
};

const STORAGE_HEALTH_SEMANTICS: Record<StorageHealth, StorageHealthSemantics> = {
  ok: {
    health: 'ok',
    readable: true,
    authoritativeAppend: true,
    authoritativeLease: true,
    authoritativeEvidenceRef: true,
    authoritativeExport: true,
    historyCoherent: true,
    requiresHealthAnnotation: false,
  },
  'log-tail-repaired': {
    health: 'log-tail-repaired',
    readable: true,
    authoritativeAppend: true,
    authoritativeLease: true,
    authoritativeEvidenceRef: true,
    authoritativeExport: true,
    historyCoherent: true,
    requiresHealthAnnotation: true,
  },
  'log-interior-corrupt': {
    health: 'log-interior-corrupt',
    readable: true,
    authoritativeAppend: false,
    authoritativeLease: true,
    authoritativeEvidenceRef: true,
    authoritativeExport: true,
    historyCoherent: false,
    requiresHealthAnnotation: true,
  },
  'network-fs-degraded': {
    health: 'network-fs-degraded',
    readable: true,
    authoritativeAppend: false,
    authoritativeLease: false,
    authoritativeEvidenceRef: false,
    authoritativeExport: false,
    historyCoherent: true,
    requiresHealthAnnotation: true,
  },
  'read-only': {
    health: 'read-only',
    readable: true,
    authoritativeAppend: false,
    authoritativeLease: false,
    authoritativeEvidenceRef: false,
    authoritativeExport: false,
    historyCoherent: true,
    requiresHealthAnnotation: true,
  },
  unusable: {
    health: 'unusable',
    readable: false,
    authoritativeAppend: false,
    authoritativeLease: false,
    authoritativeEvidenceRef: false,
    authoritativeExport: false,
    historyCoherent: false,
    requiresHealthAnnotation: true,
  },
};

const STORAGE_HEALTH_SET: ReadonlySet<string> = new Set<string>(STORAGE_HEALTH_STATES);

const normalizeStorageHealth = (health: StorageHealth | string): StorageHealth =>
  STORAGE_HEALTH_SET.has(health) ? (health as StorageHealth) : 'unusable';

const operationAvailability = (
  semantics: StorageHealthSemantics,
  operation: AuthoritativeStorageOperation,
): boolean => {
  switch (operation) {
    case 'append':
      return semantics.authoritativeAppend;
    case 'lease':
      return semantics.authoritativeLease;
    case 'evidence-ref':
      return semantics.authoritativeEvidenceRef;
    case 'export':
      return semantics.authoritativeExport;
  }
};

const blockedOperationCode = (
  health: StorageHealth,
  operation: AuthoritativeStorageOperation,
): StorageError['code'] => {
  if (health === 'network-fs-degraded') {
    return 'network-fs-degraded';
  }

  if (health === 'log-interior-corrupt' && operation === 'append') {
    return 'log-interior-corrupt';
  }

  return 'lease-unavailable';
};

export const getStorageHealthSemantics = (health: StorageHealth | string): StorageHealthSemantics =>
  STORAGE_HEALTH_SEMANTICS[normalizeStorageHealth(health)];

export const requireAuthoritativeStorageOperation = (
  health: StorageHealth | string,
  operation: AuthoritativeStorageOperation,
): Result<true, StorageError> => {
  const normalizedHealth = normalizeStorageHealth(health);
  const semantics = getStorageHealthSemantics(normalizedHealth);

  if (operationAvailability(semantics, operation)) {
    return { ok: true, value: true };
  }

  return {
    ok: false,
    error: {
      code: blockedOperationCode(normalizedHealth, operation),
      health: normalizedHealth,
      message: `Authoritative ${operation} is unavailable while storage health is ${normalizedHealth}.`,
    },
  };
};

export const getStorageCapabilityMatrix = (health: StorageHealth | string): StorageCapabilityMatrix => {
  const semantics = getStorageHealthSemantics(health);
  const guaranteesProven = semantics.authoritativeAppend && semantics.authoritativeLease && semantics.historyCoherent;

  return {
    durableLogging: guaranteesProven,
    coordination: guaranteesProven,
    unattendedRun: guaranteesProven,
    autoRecover: guaranteesProven,
  };
};
