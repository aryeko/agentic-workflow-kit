import { describe, expect, it } from 'vitest';
import { validateCodexToolSchemas } from '../src/drivers/codex-mcp/schemaValidation';

describe('validateCodexToolSchemas', () => {
  it('accepts a codex tool with an object input schema', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).not.toThrow();
  });

  it('accepts supported child-session override input keys', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              cwd: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
              'base-instructions': { type: 'string' },
            },
          },
        },
      ]),
    ).not.toThrow();
  });

  it('rejects missing codex tool', () => {
    expect(() => validateCodexToolSchemas([{ name: 'other', inputSchema: { type: 'object' } }])).toThrow(
      'Codex MCP server must expose a codex tool',
    );
  });

  it('rejects a codex tool without a prompt input property', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP codex tool must declare a prompt input property');
  });

  it('rejects approval policy schemas that omit supported values', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': { enum: ['never'] },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP approval-policy input enum must include "on-failure"');
  });

  it('rejects a codex tool without an approval-policy input property', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP codex tool must declare an approval-policy input property');
  });

  it('rejects a codex tool without a sandbox input property', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP codex tool must declare a sandbox input property');
  });

  it('rejects a codex tool without a model input property', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP codex tool must declare a model input property');
  });

  it('rejects a codex tool without a config input property', () => {
    expect(() =>
      validateCodexToolSchemas([
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              'approval-policy': {
                enum: ['untrusted', 'on-failure', 'on-request', 'never'],
              },
              sandbox: {
                enum: ['read-only', 'workspace-write', 'danger-full-access'],
              },
            },
          },
        },
      ]),
    ).toThrow('Codex MCP codex tool must declare a config input property');
  });
});
