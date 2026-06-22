import { describe, expect, it } from 'vitest';
import { AUTHORITATIVE_STORAGE_OPERATIONS, getStorageCapabilityMatrix } from '../../../../src/index.js';

describe('fnd-02-s1 storage capability matrix', () => {
  it('treats durable logging and coordination guarantees as absent when health cannot prove them', () => {
    expect(getStorageCapabilityMatrix('ok')).toEqual({
      durableLogging: true,
      coordination: true,
      unattendedRun: true,
      autoRecover: true,
    });

    expect(getStorageCapabilityMatrix('log-tail-repaired')).toEqual({
      durableLogging: true,
      coordination: true,
      unattendedRun: true,
      autoRecover: true,
    });

    expect(getStorageCapabilityMatrix('log-interior-corrupt')).toEqual({
      durableLogging: false,
      coordination: false,
      unattendedRun: false,
      autoRecover: false,
    });

    expect(getStorageCapabilityMatrix('network-fs-degraded')).toEqual({
      durableLogging: false,
      coordination: false,
      unattendedRun: false,
      autoRecover: false,
    });

    expect(getStorageCapabilityMatrix('read-only')).toEqual({
      durableLogging: false,
      coordination: false,
      unattendedRun: false,
      autoRecover: false,
    });

    expect(getStorageCapabilityMatrix('unusable')).toEqual({
      durableLogging: false,
      coordination: false,
      unattendedRun: false,
      autoRecover: false,
    });
  });

  it('treats unknown health input as unusable and therefore all guarantees absent', () => {
    expect(Object.isFrozen(AUTHORITATIVE_STORAGE_OPERATIONS)).toBe(true);
    expect(() => {
      (AUTHORITATIVE_STORAGE_OPERATIONS as unknown as string[])[0] = 'mutated';
    }).toThrow(TypeError);

    expect(getStorageCapabilityMatrix('ambiguous-health' as never)).toEqual({
      durableLogging: false,
      coordination: false,
      unattendedRun: false,
      autoRecover: false,
    });
    expect(AUTHORITATIVE_STORAGE_OPERATIONS).toEqual(['append', 'lease', 'evidence-ref', 'export']);
  });
});
