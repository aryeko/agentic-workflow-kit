import { describe, expect, it } from 'vitest';
import { codexReplyInputSchema, normalizeVerdictInput, validateReplyInput } from '../src/mcp/tools';

describe('normalizeVerdictInput', () => {
  it('maps approve-style aliases to PASS (case-insensitive)', () => {
    for (const alias of ['approve', 'Approved', 'LGTM', 'ship', 'pass', 'PASS']) {
      expect(normalizeVerdictInput({ decision: alias })?.decision).toBe('PASS');
    }
  });

  it('maps request-changes-style aliases to BLOCK (case-insensitive)', () => {
    for (const alias of ['request-changes', 'request_changes', 'changes', 'reject', 'Block', 'BLOCK']) {
      expect(normalizeVerdictInput({ decision: alias })?.decision).toBe('BLOCK');
    }
  });

  it('passes through canonical decisions unchanged', () => {
    expect(normalizeVerdictInput({ decision: 'PASS' })?.decision).toBe('PASS');
    expect(normalizeVerdictInput({ decision: 'BLOCK' })?.decision).toBe('BLOCK');
  });

  it('returns undefined when no verdict is supplied', () => {
    expect(normalizeVerdictInput(undefined)).toBeUndefined();
    expect(normalizeVerdictInput(null)).toBeUndefined();
  });

  it('throws on an unknown decision token', () => {
    expect(() => normalizeVerdictInput({ decision: 'maybe' })).toThrow(/unknown review decision/i);
  });

  it('preserves findings, summary, and loop while normalizing the decision', () => {
    const result = normalizeVerdictInput({
      decision: 'lgtm',
      findings: [{ title: 'nit', severity: 'low' }],
      summary: 'all good',
      loop: 2,
    });
    expect(result).toEqual({
      decision: 'PASS',
      findings: [{ title: 'nit', severity: 'low' }],
      summary: 'all good',
      loop: 2,
    });
  });
});

describe('codexReplyInputSchema (plain object, published inputSchema)', () => {
  it('accepts a structured verdict with no message', () => {
    const parsed = codexReplyInputSchema.parse({
      sessionId: 's1',
      verdict: { decision: 'PASS' },
    });
    expect(parsed.verdict?.decision).toBe('PASS');
    expect(parsed.message).toBeUndefined();
  });

  it('accepts a message with no verdict', () => {
    const parsed = codexReplyInputSchema.parse({ sessionId: 's1', message: 'keep going' });
    expect(parsed.message).toBe('keep going');
    expect(parsed.verdict).toBeUndefined();
  });

  it('accepts neither message nor verdict at the schema level (enforced by the handler helper)', () => {
    const parsed = codexReplyInputSchema.parse({ sessionId: 's1' });
    expect(parsed.message).toBeUndefined();
    expect(parsed.verdict).toBeUndefined();
  });

  it('rejects an empty message string', () => {
    expect(() => codexReplyInputSchema.parse({ sessionId: 's1', message: '' })).toThrow();
  });

  it('accepts a verdict with a findings array and BLOCK decision', () => {
    const parsed = codexReplyInputSchema.parse({
      runPath: '/tmp/run',
      storyId: 'WK001',
      verdict: {
        decision: 'BLOCK',
        findings: [{ title: 'bug', severity: 'high', detail: 'oops', path: 'src/a.ts' }],
        summary: 'needs work',
        loop: 1,
      },
    });
    expect(parsed.verdict?.findings).toHaveLength(1);
    expect(parsed.verdict?.decision).toBe('BLOCK');
  });

  it('accepts both message and verdict together', () => {
    const parsed = codexReplyInputSchema.parse({
      sessionId: 's1',
      message: 'verdict attached',
      verdict: { decision: 'PASS' },
    });
    expect(parsed.message).toBe('verdict attached');
    expect(parsed.verdict?.decision).toBe('PASS');
  });

  it('stays a ZodObject so the published inputSchema exposes .properties', () => {
    expect(codexReplyInputSchema.shape.cwd).toBeDefined();
    expect(codexReplyInputSchema.shape.message).toBeDefined();
    expect(codexReplyInputSchema.shape.verdict).toBeDefined();
  });

  it('accepts friendly decision aliases at the MCP boundary (the published schema must not reject them)', () => {
    for (const alias of ['approve', 'approved', 'lgtm', 'ship', 'pass']) {
      const result = codexReplyInputSchema.safeParse({ sessionId: 's1', verdict: { decision: alias } });
      expect(result.success).toBe(true);
    }
    for (const alias of ['request-changes', 'request_changes', 'changes', 'reject', 'block']) {
      const result = codexReplyInputSchema.safeParse({ sessionId: 's1', verdict: { decision: alias } });
      expect(result.success).toBe(true);
    }
  });

  it('accepts mixed-case decision aliases at the MCP boundary', () => {
    for (const alias of ['Approve', 'LGTM', 'Request-Changes', 'BLOCK', 'Pass']) {
      const result = codexReplyInputSchema.safeParse({ sessionId: 's1', verdict: { decision: alias } });
      expect(result.success).toBe(true);
    }
  });

  it('passes the raw alias string through the published schema unchanged (normalization is handler-level)', () => {
    const parsed = codexReplyInputSchema.parse({ sessionId: 's1', verdict: { decision: 'approve' } });
    expect(parsed.verdict?.decision).toBe('approve');
  });

  it('preserves findings/summary/loop alongside an alias decision at the boundary', () => {
    const parsed = codexReplyInputSchema.parse({
      sessionId: 's1',
      verdict: {
        decision: 'lgtm',
        findings: [{ title: 'nit', severity: 'low' }],
        summary: 'fine',
        loop: 3,
      },
    });
    expect(parsed.verdict?.decision).toBe('lgtm');
    expect(parsed.verdict?.findings).toHaveLength(1);
    expect(parsed.verdict?.summary).toBe('fine');
    expect(parsed.verdict?.loop).toBe(3);
  });

  it('rejects a non-string verdict decision at the boundary', () => {
    expect(codexReplyInputSchema.safeParse({ sessionId: 's1', verdict: { decision: 42 } }).success).toBe(false);
  });

  it('rejects a verdict object that omits a decision at the boundary', () => {
    expect(codexReplyInputSchema.safeParse({ sessionId: 's1', verdict: { summary: 'no decision' } }).success).toBe(
      false,
    );
  });
});

describe('validateReplyInput (handler-level rules)', () => {
  it('returns the normalized verdict when a message is present without a verdict', () => {
    expect(validateReplyInput({ message: 'keep going' })).toEqual({ verdict: undefined });
  });

  it('normalizes verdict aliases to the canonical decision', () => {
    expect(validateReplyInput({ verdict: { decision: 'lgtm' } })).toEqual({
      verdict: { decision: 'PASS' },
    });
    expect(validateReplyInput({ verdict: { decision: 'reject' } })).toEqual({
      verdict: { decision: 'BLOCK' },
    });
  });

  it('normalizes verdict aliases case-insensitively', () => {
    expect(validateReplyInput({ verdict: { decision: 'Approved' } })?.verdict?.decision).toBe('PASS');
    expect(validateReplyInput({ verdict: { decision: 'Block' } })?.verdict?.decision).toBe('BLOCK');
  });

  it('throws on an unknown verdict decision token', () => {
    expect(() => validateReplyInput({ verdict: { decision: 'maybe' } })).toThrow(/unknown review decision/i);
  });

  it('throws when neither message nor verdict is present', () => {
    expect(() => validateReplyInput({})).toThrow(/either a message or a structured verdict/i);
  });

  it('accepts a message together with a verdict and normalizes the verdict', () => {
    expect(validateReplyInput({ message: 'hi', verdict: { decision: 'ship' } })).toEqual({
      verdict: { decision: 'PASS' },
    });
  });
});
