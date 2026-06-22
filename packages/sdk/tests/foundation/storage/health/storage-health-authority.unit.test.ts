import { describe, expect, it } from 'vitest';
import {
  AUTHORITATIVE_STORAGE_OPERATIONS,
  getStorageHealthSemantics,
  requireAuthoritativeStorageOperation,
  type StorageHealth,
} from '../../../../src/index.js';

describe('fnd-02-s1 authoritative storage gating', () => {
  it('fails closed for append, lease, evidence-ref, and export under degraded authoritative health', () => {
    const blockedHealthStates: StorageHealth[] = ['network-fs-degraded', 'read-only', 'unusable'];

    for (const health of blockedHealthStates) {
      for (const operation of AUTHORITATIVE_STORAGE_OPERATIONS) {
        expect(requireAuthoritativeStorageOperation(health, operation)).toEqual({
          ok: false,
          error: {
            code: health === 'network-fs-degraded' ? 'network-fs-degraded' : 'lease-unavailable',
            health,
            message: `Authoritative ${operation} is unavailable while storage health is ${health}.`,
          },
        });
      }
    }
  });

  it('treats log-tail-repaired as readable health and log-interior-corrupt as append-rejecting incoherent history', () => {
    expect(getStorageHealthSemantics('log-tail-repaired')).toMatchObject({
      readable: true,
      authoritativeAppend: true,
      historyCoherent: true,
      requiresHealthAnnotation: true,
    });

    expect(getStorageHealthSemantics('log-interior-corrupt')).toMatchObject({
      readable: true,
      authoritativeAppend: false,
      historyCoherent: false,
      requiresHealthAnnotation: true,
    });
    expect(requireAuthoritativeStorageOperation('log-interior-corrupt', 'append')).toEqual({
      ok: false,
      error: {
        code: 'log-interior-corrupt',
        health: 'log-interior-corrupt',
        message: 'Authoritative append is unavailable while storage health is log-interior-corrupt.',
      },
    });
  });

  it('fails closed for unknown or malformed health input without throwing', () => {
    const malformedHealth = 'mystery-health' as StorageHealth;

    expect(getStorageHealthSemantics(malformedHealth)).toMatchObject({
      health: 'unusable',
      readable: false,
      authoritativeAppend: false,
      authoritativeLease: false,
      authoritativeEvidenceRef: false,
      authoritativeExport: false,
      historyCoherent: false,
      requiresHealthAnnotation: true,
    });

    for (const operation of AUTHORITATIVE_STORAGE_OPERATIONS) {
      expect(requireAuthoritativeStorageOperation(malformedHealth, operation)).toEqual({
        ok: false,
        error: {
          code: 'lease-unavailable',
          health: 'unusable',
          message: `Authoritative ${operation} is unavailable while storage health is unusable.`,
        },
      });
    }
  });
});
